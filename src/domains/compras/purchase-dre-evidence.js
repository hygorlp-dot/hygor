import {active,buildFinancialLedger,selectCashFlow,selectCommitments,selectDRE} from '../financeiro/ledger.js';
import {financialEntry} from '../financeiro/workspace.js';

const key=value=>String(value??'');

export function purchaseDreEvidence(data,dossier,onlyWork=''){
 const orders=new Set(dossier.orders.filter(active).map(order=>key(order.id)));
 const invoices=new Set(dossier.invoices.filter(note=>active(note)&&orders.has(key(note.pedidoId))).map(note=>key(note.id)));
 const ledger=buildFinancialLedger(data);
 const events=ledger.events.filter(event=>(!onlyWork||key(event.obraId)===key(onlyWork))&&
  (event.sourceType==='pedido'&&orders.has(key(event.sourceId))||
   ['nota_fiscal','pagamento_nota'].includes(event.sourceType)&&invoices.has(key(event.sourceId))));
 const scope={events};
 const commitments=selectCommitments(scope).items;
 const dre=selectDRE(scope);
 const cash=selectCashFlow(scope);
 const groups=new Map();
 for(const event of dre.events){
  const groupKey=JSON.stringify([event.obraId,event.competence]);
  if(!groups.has(groupKey))groups.set(groupKey,{obraId:event.obraId,competence:event.competence,events:[]});
  groups.get(groupKey).events.push(event);
 }
 const costs=[...groups.values()].map(group=>({
  obraId:group.obraId,competence:group.competence,
  amountCents:selectDRE({events:group.events}).costCents,
  invoiceIds:[...new Set(group.events.map(event=>key(event.sourceId)))],
  items:group.events.map(event=>financialEntry(data,{...event,amountCents:event.effect==='cost_reversal'?-event.amountCents:event.amountCents})),
 })).sort((a,b)=>String(b.competence).localeCompare(String(a.competence)));
 return {committedCents:commitments.reduce((sum,item)=>sum+item.increaseCents,0),
  openCommitmentCents:commitments.reduce((sum,item)=>sum+item.balanceCents,0),
  costCents:dre.costCents,paidCents:cash.cashOutCents,clientPaidCents:cash.thirdPartyPaidCents,costs};
}
