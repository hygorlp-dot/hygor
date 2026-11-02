import {PAYABLE_PAYMENT_COMMAND as CMD} from '../../domains/financeiro/payable-payment-commands.js';
import Dexie from 'dexie';
export function createAttemptStore(name='marcell-confirmations-v1'){
 const db=new Dexie(name);db.version(1).stores({records:'&key,owner,kind'});const records=db.table('records');
 const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('marcell-confirmations'));};
 return {
  db,
  async list(owner){return records.where('owner').equals(owner).toArray();},
  async pending(owner){return (await records.where('owner').equals(owner).toArray()).filter(r=>r.kind==='pending');},
  async protect(owner,command,context={}){
   if(command.actorId!==owner)throw Error('A operação não pertence ao usuário atual.');
   const key=JSON.stringify(['pending',owner,[CMD.PAYABLE_PAYMENT_RECORDED,CMD.ORDER_PAYMENT_ALLOCATED,CMD.PAYABLE_PAYMENT_REVERSED].includes(command.type)?'financial':command.type,command.payload?.targetId||command.payload?.pedidoId]);
   await db.transaction('rw',records,async()=>{const old=await records.get(key);if(old&&old.command.idempotencyKey!==command.idempotencyKey)throw Error('Já existe uma confirmação pendente neste registro. Use Retomar trabalho salvo.');await records.put({key,owner,kind:'pending',command,context,createdAt:old?.createdAt||new Date().toISOString()});}).finally(changed);return key;
  },
  async resolve(key,confirmed){await db.transaction('rw',records,async()=>{const row=await records.get(key);if(confirmed&&row?.command.payload?.targetType)await records.delete(JSON.stringify(['draft',row.owner,row.command.payload.targetType,row.command.payload.targetId]));await records.delete(key);});changed();},
  async draft(owner,type,id,value,context={}){const key=JSON.stringify(['draft',owner,type,id]);if(value===undefined)return (await records.get(key))?.value;if(value===null)await records.delete(key);else await records.put({key,owner,kind:'draft',type,id,value,context,createdAt:new Date().toISOString()});changed();},
 };
}
export const attemptStore=createAttemptStore();
