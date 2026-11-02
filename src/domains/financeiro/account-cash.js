import {active} from './ledger.js';
import {isFinancialDate} from './dates.js';
import {financialEntry} from './workspace.js';

// Zero must be explicit. Money is always calculated in integer cents.
export function accountMoneyCents(value){
 if(!['string','number'].includes(typeof value)||String(value).trim()==='')return null;
 const number=Number(value),cents=Math.round(number*100);
 return Number.isFinite(number)&&Number.isSafeInteger(cents)&&Math.abs(number*100-cents)<0.000001?cents:null;
}

export function accountCashPosition(data,{accountId,opening,openingDate,referenceDate}={}){
 const transactions=(data.transacoes||[]).filter(t=>active(t)&&String(t.contaBancariaId||'')===String(accountId)&&accountId);
 const ids=new Set(),issues=[],movements=[];
 const validRange=isFinancialDate(openingDate)&&isFinancialDate(referenceDate)&&openingDate<=referenceDate;
 for(const transaction of transactions){
  const date=transaction.data;
  if(!isFinancialDate(date)){issues.push({transaction,reason:'Data bancária inválida ou ausente'});continue;}
  if(!validRange||date<openingDate||date>referenceDate)continue;
  const cents=accountMoneyCents(transaction.valor),id=String(transaction.id||'');
  if(!id||ids.has(id)||cents===null){issues.push({transaction,reason:!id||ids.has(id)?'Identificação bancária ausente ou repetida':'Valor bancário inválido'});continue;}
  ids.add(id);movements.push({transaction,cents});
 }
 const openingCents=accountMoneyCents(opening);
 const incoming=movements.filter(m=>m.cents>0).reduce((s,m)=>s+m.cents,0);
 const outgoing=movements.filter(m=>m.cents<0).reduce((s,m)=>s-m.cents,0);
 const candidate=openingCents===null?null:openingCents+incoming-outgoing;
 const canCalculate=validRange&&openingCents!==null&&!issues.length&&Number.isSafeInteger(candidate)&&Number.isSafeInteger(incoming)&&Number.isSafeInteger(outgoing);
 return {openingCents,incoming,outgoing,validRange,canCalculate,balanceCents:canCalculate?candidate:null,
  movements,pending:movements.filter(m=>!['conciliado','ignorado'].includes(m.transaction.status)),
  partial:movements.filter(m=>m.transaction.status==='parcial'),
  ignored:movements.filter(m=>m.transaction.status==='ignorado'),issues};
}

export function accountMovementEntries(data,ledger,movements){
 return movements.map(({transaction,cents,reason})=>{
  const linkedIds=new Set((data.reconciliationLinks||[]).filter(link=>link.status==='active'&&link.transactionId===String(transaction.id)).map(link=>link.eventId));
  const origins=(ledger.events||[]).filter(e=>e.transactionId===transaction.id||linkedIds.has(e.id)).map(e=>financialEntry(data,e));
  const workIds=[...new Set([transaction.obraId,...origins.map(e=>e.obraId)].filter(Boolean))];
  const obraId=workIds.length===1?workIds[0]:'';
  return {id:`bank:${transaction.id}`,sourceType:'transacao_bancaria',sourceId:transaction.id,
   description:transaction.descricao||'Movimento bancário',date:transaction.data,
   amountCents:cents??accountMoneyCents(transaction.valor)??0,direction:Number(transaction.valor)<0?'Saída':'Entrada',
   obraId,obra:workIds.length>1?'Múltiplas obras':(data.obras||[]).find(o=>String(o.id)===String(obraId))?.name||obraId||'Empresa (sem obra)',
   record:transaction,documents:origins.flatMap(e=>e.documents||[]),invoices:origins.flatMap(e=>[...(e.sourceType==='nota_fiscal'&&e.record?[e.record]:[]),...(e.invoices||[])]),
   metadata:{situacao:transaction.status||'pendente',...(reason?{pendencia:reason}:{}),origens:origins}};
 });
}
