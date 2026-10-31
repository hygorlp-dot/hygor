import {calcOrcadoComprado} from '../compras/budget-tracking.js';
import {selectDRE,selectCashFlow,toCents} from './ledger.js';
import {financialEntry} from './workspace.js';
import {costPlanningFingerprint} from './cost-control.js';

export function workStageCosts(data,ledger,obraId,asOf){
 const tracking=calcOrcadoComprado(data,obraId),budget=tracking.orc;
 const stages=new Map((budget?.etapas||[]).map(e=>[e.id,e]));
 const root=id=>{const seen=new Set();let e=stages.get(id);while(e?.parentId){if(seen.has(e.id))return '';seen.add(e.id);e=stages.get(e.parentId);}return e?.id||'';};
 const rows=tracking.linhas.map(l=>({id:l.it.id,label:l.it.descricao,budget:toCents(l.orcado),committed:toCents(l.comprometido),received:toCents(l.recebido),incurred:0,paid:0,clientPaid:0,entries:{budget:[],committed:[],received:[],incurred:[],paid:[],clientPaid:[]},orders:l.pedidos}));
 for(const stage of budget?.etapas||[]){if(!stage.parentId&&!rows.some(r=>r.id===stage.id))rows.push({id:stage.id,label:stage.nome||'Etapa',budget:0,committed:0,received:0,incurred:0,paid:0,clientPaid:0,entries:{budget:[],committed:[],received:[],incurred:[],paid:[],clientPaid:[]}});}
 const unassigned={id:'unassigned',label:'Sem apropriação',budget:0,committed:toCents(tracking.semApropriacao),received:toCents(tracking.semApropriacaoRecebida),incurred:0,paid:0,clientPaid:0,entries:{budget:[],committed:[],received:[],incurred:[],paid:[],clientPaid:[]}};rows.push(unassigned);
 const rowFor=id=>rows.find(r=>r.id===id)||unassigned;
 const orderStage=order=>{const ids=new Set((order?.itens||[]).map(i=>root(i.orcNivel1Id||budget?.itens?.find(b=>b.id===i.orcItemId)?.etapaId)));return ids.size===1?[...ids][0]:'';};
 for(const row of rows){
   for(const item of budget?.itens||[]){if(item.tipo==='titulo'||root(item.etapaId)!==row.id)continue;row.entries.budget.push({id:`budget:${item.id}`,description:item.descricao||item.nome||'Item do orçamento',amountCents:toCents(Number(item.quantidade||0)*Number(item.precoUnit||0)),obraId,obra:(data.obras||[]).find(o=>o.id===obraId)?.name,sourceType:'orcamento',sourceId:budget.id,record:item});}
   for(const order of row.orders||[]){if(order.rascunho)continue;const entry=financialEntry(data,{id:`order:${order.id}:${row.id}`,sourceType:'pedido',sourceId:order.id,obraId,amountCents:toCents(order.valor)});row.entries.committed.push(entry);row.entries.received.push({...entry,amountCents:toCents(order.recebido),note:"Quantidade recebida valorizada pelo critério do controle de compras."});}
 }
 for(const p of tracking.pedidosSemApropriacao||[]){const e=financialEntry(data,{id:`unassigned:${p.id}:${p.item.id}`,sourceType:'pedido',sourceId:p.id,obraId,amountCents:toCents(p.valor)});unassigned.entries.committed.push(e);unassigned.entries.received.push({...e,amountCents:toCents(p.recebido)});}
 const scoped={obraId,endDate:asOf};
 const costs=selectDRE(ledger,{obraId,endDate:asOf.slice(0,7)}).events;
 const cash=selectCashFlow(ledger,scoped);
 const allocate=(event,metric)=>{
   const entry=financialEntry(data,event),record=entry.record;
   const allocation=record?.rateios?.find(r=>String(r.id)===event.sourceSubId&&r.obraId===obraId);
   const explicit=allocation?.etapaId||event.metadata?.etapaId||record?.etapaId||record?.orcNivel1Id;
   const invoice=event.sourceType==='pagamento_nota'?record:null;
   const ambiguous=record?.rateios?.filter(r=>r.obraId===obraId).length>1;
   const mapped=explicit?root(explicit):(!ambiguous&&record?.rateios?.length<=1?root(record.rateios[0]?.etapaId):'')||orderStage((data.pedidos||[]).find(p=>p.id===(record?.pedidoId||(event.sourceType==='pedido'?record?.id:''))));
   const row=rowFor(mapped),amount=event.amountCents*(event.effect.endsWith('_reversal')?-1:1);
   // Pagamentos não carregam o identificador de rateio da nota. Não atribuir
   // uma etapa por inferência quando a nota cruza etapas ou obras.
   const target=invoice&&record.rateios?.length>1?unassigned:row;
   target[metric]+=amount;target.entries[metric].push({...entry,amountCents:amount});
 };
 costs.filter(e=>e.effect==='cost'||e.effect==='cost_reversal').forEach(e=>allocate(e,'incurred'));
 cash.events.filter(e=>e.effect==='cash_out').forEach(e=>allocate(e,'paid'));
 cash.thirdPartyEvents.forEach(e=>allocate(e,'clientPaid'));
 const fingerprint=costPlanningFingerprint(data,obraId);
 const planning=(data.obras||[]).find(w=>w.id===obraId)?.costPlanning;
 for(const row of rows){
   row.automaticRemaining=Math.max(0,row.budget-row.incurred,row.committed-row.incurred);
   row.revision=planning?.stages?.[row.id]||null;
   row.reviewValid=Boolean(row.revision&&row.revision.budgetId===budget?.id&&row.revision.fingerprint===fingerprint&&row.revision.asOf===asOf&&['incurred','committed','budget'].every(k=>row.revision.basis?.[k]===row[k]));
   row.remaining=row.reviewValid?row.revision.remainingCents:row.automaticRemaining;
   row.forecast=row.incurred+row.remaining;
   row.deviation=row.forecast-row.budget;
 }
 return {budget,reason:tracking.motivo,fingerprint,planningVersion:Number(planning?.version||0),rows,totals:Object.fromEntries(['budget','committed','received','incurred','paid','clientPaid','remaining','forecast','deviation'].map(k=>[k,rows.reduce((s,r)=>s+r[k],0)]))};
}
