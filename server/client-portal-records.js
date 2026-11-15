import {isDeepStrictEqual} from 'node:util';
// Identidade é o ID cadastrado. Nunca unir por valor, fornecedor ou descrição.
export function uniquePortalRecords(records=[]){
 const seen=new Map();
 return records.filter(record=>{
  if(!record?.id)return true;
  const id=String(record.id);
  if(!seen.has(id)){seen.set(id,record);return true;}
  if(!isDeepStrictEqual(seen.get(id),record))throw Object.assign(new Error('Registros com o mesmo ID divergem. Confira a origem antes de liberar o portal.'),{status:503});
  return false;
 });
}
