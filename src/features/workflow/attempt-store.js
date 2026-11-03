import {PAYABLE_PAYMENT_COMMAND_TYPES} from '../../domains/financeiro/payable-payment-commands.js';
import Dexie from 'dexie';
const targetKey=command=>{
 const p=command?.payload||{},financial=PAYABLE_PAYMENT_COMMAND_TYPES.has(command?.type);
 return JSON.stringify([financial?'financial':command?.type,financial?p.targetType||'pedido':null,String(p.targetId??p.pedidoId)]);
};
export function createAttemptStore(name='marcell-confirmations-v1'){
 const db=new Dexie(name),schema='&key,owner,kind';
 // A cópia e a retirada da tabela antiga fazem parte da mesma atualização
 // IndexedDB. Clientes antigos não podem gravar pelo protocolo anterior.
 db.version(2).stores({records:schema});
 db.version(3).stores({records:schema,operations:schema}).upgrade(async tx=>{const rows=await tx.table('records').toArray();if(rows.length)await tx.table('operations').bulkPut(rows);});
 db.version(4).stores({records:null,operations:schema});
 // Dexie pode recriar tabelas removidas em clientes antigos. Manter a tabela
 // anterior com chave incompatível faz a escrita antiga falhar antes do envio.
 db.version(5).stores({records:'[key+format],owner,kind'});
 const records=db.table('operations');
 const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('marcell-confirmations'));};
 return {
  db,
  async list(owner){return records.where('owner').equals(owner).toArray();},
  async pending(owner){return (await records.where('owner').equals(owner).toArray()).filter(r=>r.kind==='pending');},
  async protect(owner,command,context={}){
   if(command.actorId!==owner)throw Error('A operação não pertence ao usuário atual.');
   const resource=targetKey(command);let key=JSON.stringify(['pending',owner,resource]);
   await db.transaction('rw',records,async()=>{
    const old=await records.where('owner').equals(owner).filter(r=>r.kind==='pending'&&targetKey(r.command)===resource).first();
    if(old&&old.command.idempotencyKey!==command.idempotencyKey)throw Error('Já existe uma confirmação pendente neste registro. Use Retomar trabalho salvo.');
    if(old)key=old.key;
    await records.put({key,owner,kind:'pending',command,context,createdAt:old?.createdAt||new Date().toISOString()});
   }).finally(changed);return key;
  },
  async resolve(key,confirmed){await db.transaction('rw',records,async()=>{const row=await records.get(key);if(confirmed&&row?.command.payload?.targetType)await records.delete(JSON.stringify(['draft',row.owner,row.command.payload.targetType,row.command.payload.targetId]));await records.delete(key);});changed();},
  async draft(owner,type,id,value,context={}){const key=JSON.stringify(['draft',owner,type,id]);if(value===undefined)return (await records.get(key))?.value;if(value===null)await records.delete(key);else await records.put({key,owner,kind:'draft',type,id,value,context,createdAt:new Date().toISOString()});changed();},
 };
}
export const attemptStore=createAttemptStore();
