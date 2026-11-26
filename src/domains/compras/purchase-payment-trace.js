import {active,buildFinancialLedger,selectAccountsPayable} from '../financeiro/ledger.js';
import {activeCashAllocations} from '../conciliacao/cash-allocations.js';
import {paymentEvidence,requiresBankReconciliation} from '../financeiro/payment-evidence.js';

const key=value=>String(value??'');

export function purchasePaymentTrace(data,{orders,invoices},asOf){
 const ordersById=new Map(orders.filter(active).map(order=>[key(order.id),order]));
 const invoicesById=new Map(invoices.filter(active).map(invoice=>[key(invoice.id),invoice]));
 const ledger=buildFinancialLedger(data);
 const titleSource=item=>item.sourceType==='nota_fiscal'?invoicesById.get(key(item.sourceId)):
  item.sourceType==='pedido'?ordersById.get(key(item.sourceId)):null;
 const titles=selectAccountsPayable(ledger,{asOfDate:asOf}).items.flatMap(item=>{
  const source=titleSource(item);
  return source&&key(item.obraId)===key(source.obraId)?[{...item,source}]:[];
 });
 const allocations=new Map();
 for(const link of activeCashAllocations(data)){
  if(!allocations.has(link.eventId))allocations.set(link.eventId,[]);
  allocations.get(link.eventId).push(link);
 }
 const bank=new Map((data.transacoes||[]).filter(item=>active(item)&&!item.importReversal).map(item=>[key(item.id),item]));
 const groups=new Map();
 for(const event of ledger.events){
  if(!['cash_out','third_party_payment'].includes(event.effect)||event.date>asOf)continue;
  const invoice=event.sourceType==='pagamento_nota'?invoicesById.get(key(event.sourceId)):null;
  const order=invoice?ordersById.get(key(invoice.pedidoId)):event.sourceType==='pedido'?ordersById.get(key(event.sourceId)):null;
  if(!order||key(order.obraId)!==key(event.obraId)||(invoice&&key(invoice.obraId)!==key(order.obraId)))continue;
  const linkedPaymentId=key(event.metadata?.pagamentoPedidoId);
  const orderPaymentId=linkedPaymentId||(!invoice?key(event.sourceSubId):'');
  const sourcePayment=(invoice||order).pagamentos?.find(payment=>active(payment)&&key(payment.id)===key(event.sourceSubId));
  const original=orderPaymentId?order.pagamentos?.find(payment=>active(payment)&&key(payment.id)===orderPaymentId):null;
  const groupId=original?`pedido:${order.id}:baixa:${original.id}`:event.id;
  const origin=event.metadata?.origem||(event.effect==='third_party_payment'?'cliente_direto':null);
  const row=groups.get(groupId)||{id:groupId,order,date:original?.data||event.date,origin,amountCents:0,
   invoices:new Map(),proofs:new Map(),bankLinks:new Map()};
  row.amountCents+=event.amountCents;
  if(invoice)row.invoices.set(invoice.id,invoice);
  for(const payment of [sourcePayment,original].filter(Boolean)){
   for(const {document,reference,url} of paymentEvidence(payment).proofs){
    row.proofs.set(JSON.stringify([document.id||'',reference||'',url||'',document.nome||'']),document);
   }
  }
  if(requiresBankReconciliation({origem:origin})){
   const direct=bank.get(key(event.transactionId));
   if(direct)row.bankLinks.set(direct.id,direct);
   for(const link of allocations.get(event.id)||[]){
    const transaction=bank.get(key(link.transactionId));
    if(transaction)row.bankLinks.set(transaction.id,transaction);
   }
  }
  groups.set(groupId,row);
 }
 return {titles,payments:[...groups.values()].map(row=>({...row,invoices:[...row.invoices.values()],
  proofs:[...row.proofs.values()],bankLinks:[...row.bankLinks.values()]})).sort((a,b)=>String(b.date).localeCompare(String(a.date)))};
}
