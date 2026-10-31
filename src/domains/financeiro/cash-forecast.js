import {selectAccountsPayable,selectAccountsReceivable} from './ledger.js';
import {positionEntries} from './workspace.js';
import {isFinancialDate} from './dates.js';
export const shiftDay=(date,days)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
export function forecastCash(data,ledger,{today,obraId='all',days=30,openingCents=null,account='all',receiptDelay=0,includeOverdue=false}={}){
 const filters={asOfDate:today,...(obraId==='all'?{}:{obraId})};
 const allEntries=[...positionEntries(data,selectAccountsPayable(ledger,filters)).map(e=>({...e,direction:'Saída',sign:-1})),...positionEntries(data,selectAccountsReceivable(ledger,filters)).map(e=>({...e,direction:'Entrada',sign:1}))].map(entry=>({...entry,plannedAccountId:String(entry.record?.contaBancariaId||'')}));
 // A past settlement account does not define the intended account for a title.
 const unassigned=allEntries.filter(entry=>!entry.plannedAccountId);
 const entries=allEntries.filter(entry=>account==='all'||(account==='unassigned'?!entry.plannedAccountId:entry.plannedAccountId===account));
 const undated=[],overdue=[],scheduled=[];
 for(const e of entries){
  if(!isFinancialDate(e.dueDate)){undated.push(e);continue;}
  if(e.dueDate<today){overdue.push(e);if(!includeOverdue)continue;}
  scheduled.push({...e,forecastDate:shiftDay(e.dueDate<today?today:e.dueDate,e.sign===1?Number(receiptDelay):0)});
 }
 const hasOpening=Number.isSafeInteger(openingCents);
 let balance=hasOpening?openingCents:null;const rows=Array.from({length:days},(_,i)=>{
  const date=shiftDay(today,i),items=scheduled.filter(e=>e.forecastDate===date);
  const incoming=items.filter(e=>e.sign===1).reduce((s,e)=>s+e.amountCents,0),outgoing=items.filter(e=>e.sign===-1).reduce((s,e)=>s+e.amountCents,0);
  if(hasOpening)balance+=incoming-outgoing;return {date,items,incoming,outgoing,balance};
 });
 return {rows,undated,overdue,unassigned,account,excludedAccountCount:allEntries.length-entries.length,hasOpening,lowest:hasOpening?rows.reduce((a,b)=>b.balance<a.balance?b:a,rows[0]):null,firstNegative:hasOpening?rows.find(r=>r.balance<0):undefined,openingCents:hasOpening?openingCents:null};
}
