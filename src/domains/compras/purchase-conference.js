import {active,buildFinancialLedger,selectAccountsPayable} from '../financeiro/ledger.js';
import {positionEntries} from '../financeiro/workspace.js';
import {analyzePurchaseThreeWayMatch} from '../financeiro/workflows.js';

const same=(a,b)=>a!=null&&b!=null&&String(a)!==''&&String(a)===String(b);
const numberKnown=value=>value!=null&&value!==''&&Number.isFinite(Number(value));
export const purchaseMatchLabels={
 RECEIPT_EXCEEDS_ORDER:'Recebimento acima do pedido',
 INVOICE_EXCEEDS_ORDER:'Faturamento acima do pedido',
 INVOICE_EXCEEDS_PHYSICAL_RECEIPT:'Nota acima do recebido físico',
};

/** Explicit purchase links only. Fiscal and purchase units are never inferred. */
export function purchaseConference(data,dossier,{asOf,includeTitles=false}={}){
 const orders=dossier.orders.filter(active);
 const invoices=dossier.invoices.filter(invoice=>active(invoice)&&orders.some(order=>same(invoice.pedidoId,order.id)&&same(invoice.obraId,order.obraId)));
 const matches=orders.map(order=>({order,
  amountsKnown:(order.itens||[]).length>0&&(order.itens||[]).every(item=>numberKnown(item.qtd)&&numberKnown(item.precoUnit)&&numberKnown(item.qtdRecebida??0))&&invoices.filter(n=>same(n.pedidoId,order.id)).every(n=>numberKnown(n.valorBruto??n.valorLiquido??n.valor)),
  match:analyzePurchaseThreeWayMatch({...data,notasFiscais:invoices.filter(n=>same(n.obraId,order.obraId))},order.id)}));
 const titles=includeTitles?positionEntries(data,selectAccountsPayable(buildFinancialLedger(data),{asOfDate:asOf})).filter(entry=>
  entry.sourceType==='pedido'&&orders.some(order=>same(order.id,entry.sourceId)&&same(order.obraId,entry.obraId))||
  entry.sourceType==='nota_fiscal'&&invoices.some(invoice=>same(invoice.id,entry.sourceId)&&same(invoice.obraId,entry.obraId))):[];
 return {orders:matches,invoices,titles};
}
