import {PAYABLE_PAYMENT_COMMAND_TYPES} from '../../domains/financeiro/payable-payment-commands.js';
import {createLocalDatabase,createStore,idbResult} from '../../lib/local-indexed-db.js';
const targetKey=command=>{
 const p=command?.payload||{},financial=PAYABLE_PAYMENT_COMMAND_TYPES.has(command?.type);
 return JSON.stringify([financial?'financial':command?.type,financial?p.targetType||'pedido':null,String(p.targetId??p.pedidoId)]);
};
export function createAttemptStore(name='marcell-confirmations-v1'){
 const db=createLocalDatabase(name,50,(database,tx,oldVersion,abort)=>{
  const operations=database.objectStoreNames.contains('operations')?tx.objectStore('operations'):createStore(database,'operations','key',['owner','kind']);
  const fence=()=>{
   if(database.objectStoreNames.contains('records'))database.deleteObjectStore('records');
   createStore(database,'records',['key','format'],['owner','kind']);
  };
  // A cópia e a barreira ao protocolo antigo compartilham a transação de
  // atualização. Versão 30 já fez a cópia: não substituir operações novas.
  if(oldVersion<30&&database.objectStoreNames.contains('records')){
   const request=tx.objectStore('records').openCursor();
   request.onsuccess=()=>{try{const cursor=request.result;if(!cursor){fence();return;}const write=operations.put(cursor.value);write.onsuccess=()=>cursor.continue();}catch(error){abort(error);}};
  }else fence();
 });
 const readOwner=(records,owner)=>idbResult(records.index('owner').getAll(owner));
 const list=owner=>db.run('operations','readonly',tx=>readOwner(tx.objectStore('operations'),owner));
 const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('marcell-confirmations'));};
 return {
  db,
  list,
  async pending(owner){return (await list(owner)).filter(r=>r.kind==='pending');},
  async protect(owner,command,context={}){
   if(command.actorId!==owner)throw Error('A operação não pertence ao usuário atual.');
   const resource=targetKey(command);let key=JSON.stringify(['pending',owner,resource]);
   await db.run('operations','readwrite',async tx=>{
    const records=tx.objectStore('operations'),old=(await readOwner(records,owner)).find(r=>r.kind==='pending'&&targetKey(r.command)===resource);
    if(old&&old.command.idempotencyKey!==command.idempotencyKey)throw Error('Já existe uma confirmação pendente neste registro. Use Retomar trabalho salvo.');
    if(old)key=old.key;
    await idbResult(records.put({key,owner,kind:'pending',command,context,createdAt:old?.createdAt||new Date().toISOString()}));
   }).finally(changed);return key;
  },
  async resolve(key,confirmed){await db.run('operations','readwrite',async tx=>{const records=tx.objectStore('operations'),row=await idbResult(records.get(key));if(confirmed&&row?.command.payload?.targetType)await idbResult(records.delete(JSON.stringify(['draft',row.owner,row.command.payload.targetType,row.command.payload.targetId])));await idbResult(records.delete(key));});changed();},
  async draft(owner,type,id,value,context={}){const key=JSON.stringify(['draft',owner,type,id]);if(value===undefined)return db.run('operations','readonly',async tx=>(await idbResult(tx.objectStore('operations').get(key)))?.value);await db.run('operations','readwrite',tx=>idbResult(value===null?tx.objectStore('operations').delete(key):tx.objectStore('operations').put({key,owner,kind:'draft',type,id,value,context,createdAt:new Date().toISOString()})));changed();},
 };
}
export const attemptStore=createAttemptStore();
