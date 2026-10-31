import {active} from './ledger.js';
import {podeAcessarAba} from '../administracao/abas-acesso.js';
const collections={nota_fiscal:'notasFiscais',pedido:'pedidos',medicao:'medicoes'};
/** Resolve from the current source, never from a description or cached row alone. */
export function financeNextAction(data,item,user){
 if(!['admin','financeiro'].includes(user?.role)||!podeAcessarAba(user,'fin'))return null;
 const type=item.sourceType,collection=collections[type];
 if(!collection||!item.sourceId)return null;
 const record=(data[collection]||[]).find(row=>String(row.id)===String(item.sourceId)&&active(row));
 if(!record||String(record.obraId||'')!==String(item.obraId||'')||user.obraId&&String(record.obraId)!==String(user.obraId))return null;
 if(type==='pedido'&&!podeAcessarAba(user,'cmp'))return null;
 return {kind:type==='nota_fiscal'?'invoice':type==='pedido'?'purchase':'document',id:record.id,type,
  label:type==='nota_fiscal'?'Conferir documento':type==='pedido'?'Conferir compra':'Conferir cobrança',
  reason:type==='nota_fiscal'?'Confira o documento, vencimento e pagamentos na ficha fiscal.':type==='pedido'?'Compare pedido, entrega e notas antes de prosseguir.':'Consulte a medição e seus documentos no mesmo recorte.'};
}
