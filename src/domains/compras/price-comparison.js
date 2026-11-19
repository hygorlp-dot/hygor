import {historicoPrecoTodos} from './calculations.js';
import {conversionFactorOf,hasValidUnitConversion,purchaseUnitOf} from './unit-conversion.js';
// Only explicit, identical price bases may share a comparison. No name matching.
export const purchasePriceBasisKey=item=>item?.materialId&&String(item.unidadeRef||'').trim()&&String(item.unidadeCompra||'').trim()&&hasValidUnitConversion(item)
 ? JSON.stringify([String(item.materialId),String(item.unidadeRef).trim().toUpperCase(),purchaseUnitOf(item),conversionFactorOf(item)]) : '';
export function purchaseHistoryByBasis(orders=[]){
 const groups=new Map();
 for(const order of orders||[])for(const item of order.itens||[]){
  const key=purchasePriceBasisKey(item);if(!key)continue;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push({...order,itens:[item]});
 }
 return new Map([...groups].map(([key,list])=>[key,[...historicoPrecoTodos(list).values()].flat()]));
}
