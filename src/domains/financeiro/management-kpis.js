import {isFinancialDate} from './dates.js';

const total=(rows,key='amountCents')=>{
 if(rows.some(row=>!Number.isSafeInteger(row[key])||row[key]<0))return null;
 const value=rows.reduce((sum,row)=>sum+row[key],0);return Number.isSafeInteger(value)?value:null;
};
const difference=(a,b)=>Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&Number.isSafeInteger(a-b)?a-b:null;
const daysBetween=(a,b)=>Math.round((Date.parse(`${b}T12:00:00Z`)-Date.parse(`${a}T12:00:00Z`))/86400000);

// Receivable positions and purchase commitments come from the canonical ledger.
// These are managerial definitions over the currently loaded records, not
// accounting liquidity ratios or a reconstruction of historical knowledge.
export function managementKpis({receivable,payable,commitments,asOf,incurred,earned,finalCost,budget,cpiReason=''}){
 if(!isFinancialDate(asOf))throw new Error('Referência inválida para os indicadores financeiros.');
 const titles=receivable.map(entry=>{
  const dated=isFinancialDate(entry.dueDate),days=dated?Math.max(0,daysBetween(entry.dueDate,asOf)):null;
  const bucket=!dated?'Sem vencimento válido':days===0?'A vencer ou vence hoje':days<=30?'1 a 30 dias':days<=60?'31 a 60 dias':days<=90?'61 a 90 dias':'Mais de 90 dias';
  return {...entry,overdueDays:days,bucket};
 });
 const dated=titles.filter(entry=>entry.overdueDays!==null),overdue=dated.filter(entry=>entry.overdueDays>0),undated=titles.filter(entry=>entry.overdueDays===null);
 const datedCents=total(dated),overdueCents=total(overdue);
 const receivables={titles,totalCents:total(titles),datedCents,overdueCents,undatedCents:total(undated),undatedCount:undated.length,ratio:datedCents>0&&overdueCents!==null?overdueCents/datedCents:null,
  aging:['1 a 30 dias','31 a 60 dias','61 a 90 dias','Mais de 90 dias'].map(label=>({label,amountCents:total(overdue.filter(entry=>entry.bucket===label)),count:overdue.filter(entry=>entry.bucket===label).length}))};
 const purchases={items:commitments,openCents:total(commitments),payableCents:total(payable)};
 const safeEarned=Number.isSafeInteger(earned)?earned:null,safeActual=Number.isSafeInteger(incurred)?incurred:null;
 const cv=difference(safeEarned,safeActual),vac=difference(budget,finalCost);
 return {receivables,purchases,variance:{earned:safeEarned,actual:safeActual,cv,vac,reason:cv===null?cpiReason||'Falta base comparável de valor agregado e custo.':'',forecastReason:vac===null?'Custo final ou orçamento indisponível.':''}};
}

export function managementKpiTotals(rows){
 const models=rows.map(row=>row.managementKpis),receivables=models.flatMap(item=>item.receivables.titles),purchases=models.flatMap(item=>item.purchases.items);
 const dated=receivables.filter(item=>item.overdueDays!==null),overdue=dated.filter(item=>item.overdueDays>0),datedCents=total(dated),overdueCents=total(overdue);
 const signedTotal=key=>{const values=models.map(item=>item.variance[key]);if(values.some(value=>!Number.isSafeInteger(value)))return null;const result=values.reduce((sum,value)=>sum+value,0);return Number.isSafeInteger(result)?result:null;};
 return {overdueCents,datedCents,ratio:datedCents>0&&overdueCents!==null?overdueCents/datedCents:null,undatedCents:total(receivables.filter(item=>item.overdueDays===null)),undatedCount:receivables.filter(item=>item.overdueDays===null).length,openPurchaseCents:total(purchases),cv:signedTotal('cv'),vac:signedTotal('vac'),comparableWorks:models.filter(item=>item.variance.cv!==null).length,workCount:rows.length};
}
