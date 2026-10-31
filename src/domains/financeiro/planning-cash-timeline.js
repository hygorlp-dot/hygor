import {isFinancialDate} from './dates.js';
import {shiftDay} from './cash-forecast.js';
import {planningRequestCoverage} from './planning-coverage.js';
const active=r=>r&&!r.deletedAt&&r.ativo!==false&&!['cancelada','cancelado','estornada','estornado','rejeitada','rejeitado'].includes(r.status);
const identified=value=>value!==undefined&&value!==null&&String(value).trim()!=='';
const sameId=(a,b)=>identified(a)&&identified(b)&&String(a)===String(b);

// References, commitments and obligations remain separate; this is not a new cash engine.
export function planningCashTimeline(data,{obraId,today,days=30,shift=0,forecastRows=[]}={}){
 const end=shiftDay(today,days-1),within=date=>isFinancialDate(date)&&date>=today&&date<=end;
 const plan=(data.planos||[]).find(p=>String(p.obraId)===String(obraId)&&active(p));
 const stages=new Map();
 const titles=forecastRows.flatMap(r=>r.items).filter(e=>String(e.obraId)===String(obraId));
 for(const task of plan?.tarefas||[]){
  if(!active(task)||task.titulo||!task.etapaId)continue;
  const row=stages.get(task.etapaId)||{id:task.etapaId,label:task.nome||'Etapa sem nome',dates:[],invalidDates:0};
  if(isFinancialDate(task.inicio))row.dates.push(task.inicio);else row.invalidDates++;
  stages.set(task.etapaId,row);
 }
 const rows=[...stages.values()].map(stage=>{
  const date=stage.dates.sort()[0]||'',simulated=date?shiftDay(date,shift):'';
  const requests=(data.solicitacoesCompra||[]).filter(r=>active(r)&&identified(r.id)&&sameId(r.obraId,obraId)&&sameId(r.planningOrigin?.planId,plan.id)&&sameId(r.planningOrigin?.stageId,stage.id)&&(!r.planningOrigin.budgetId||sameId(r.planningOrigin.budgetId,plan.budgetId)));
  const orders=(data.pedidos||[]).filter(o=>active(o)&&identified(o.id)&&o.status!=='rascunho'&&sameId(o.obraId,obraId)&&requests.some(r=>sameId(r.id,o.solicitacaoId)));
  const coverage=requests.map(request=>planningRequestCoverage(request,orders,simulated));
  const uncommitted=coverage.filter(item=>!item.complete).map(item=>item.request);
  const invalidQuantities=requests.filter(r=>!(r.itens?.length)||r.itens.some(i=>!Number.isFinite(Number(i.quantidade))||Number(i.quantidade)<=0||!(i.unidadeCompra||i.unidadeRef))).length;
  const lateOrders=orders.filter(o=>isFinancialDate(o.previsao)&&simulated&&o.previsao>simulated);
  const stageTitles=titles.filter(e=>orders.some(o=>sameId(o.id,e.record?.pedidoId)||(e.sourceType==='pedido'&&sameId(o.id,e.sourceId))));
  return {...stage,date,simulated,requests,orders,coverage,uncommitted,invalidQuantities,lateOrders,titles:stageTitles,inPeriod:within(date),inSimulation:within(simulated)};
 });
 const linkedOrderIds=new Set(rows.flatMap(r=>r.orders.map(o=>String(o.id))));
 const unlinkedOrders=(data.pedidos||[]).filter(o=>active(o)&&o.status!=='rascunho'&&String(o.obraId)===String(obraId)&&!linkedOrderIds.has(String(o.id)));
 const unlinkedTitles=titles.filter(e=>!rows.some(r=>r.titles.includes(e)));
 const unknownRequests=(data.solicitacoesCompra||[]).filter(r=>active(r)&&String(r.obraId)===String(obraId)&&!rows.some(s=>s.requests.some(q=>q.id===r.id)));
 return {rows:rows.sort((a,b)=>(a.simulated||'9999').localeCompare(b.simulated||'9999')),end,originalCount:rows.filter(r=>r.inPeriod).length,simulatedCount:rows.filter(r=>r.inSimulation).length,undated:rows.filter(r=>!r.date||r.invalidDates).length,unlinkedOrders,unknownRequests,titles,unlinkedTitles};
}
