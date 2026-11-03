import {scheduleSpi} from '../planejamento/approved-baseline.js';
import {isFinancialDate} from '../financeiro/dates.js';
import {shiftDay} from '../financeiro/cash-forecast.js';
import {productionBudget,productionNumber} from '../diario-obra/production.js';
import {contar} from '../../design-system/copy.js';

export const SCHEDULE_INDICATORS_VERSION='2026-11-02.1';
const days=(start,end)=>Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000);
const validRange=row=>isFinancialDate(row?.inicio)&&isFinancialDate(row?.fim)&&row.inicio<=row.fim;
// Parent stages with no own priced items are summaries in the Gantt, not deliveries.
function isSummary(task,budget){
 return task.titulo||task.etapaId&&(budget?.etapas||[]).some(stage=>stage.parentId===task.etapaId)&&!(budget?.itens||[]).some(item=>item.etapaId===task.etapaId&&item.tipo!=='titulo'&&Number(item.quantidade)*Number(item.precoUnit)>0);
}
function diaryEvidence(data,obraId,taskId,asOf){
 const logs=(data.rdos||[]).filter(log=>log.obraId===obraId&&isFinancialDate(log.data)&&log.data<=asOf&&log.status!=='cancelado');
 const records=logs.filter(log=>(log.servicos||[]).some(service=>service.tarefaId===taskId)).sort((a,b)=>a.data.localeCompare(b.data));
 let progress=null,completedAt='',sourceId='',sourceDate='',reason='Sem avanço acumulado revisado no diário.';
 for(const log of records){
  const services=log.servicos.filter(service=>service.tarefaId===taskId);
  // A pending newer diary never replaces the last reviewed measurement.
  if(log.status!=='concluido'||!log.revisaoEngenheiro?.aprovado)continue;
  const ambiguous=logs.filter(other=>other.data===log.data).length!==1||services.length!==1;
  const value=productionNumber(services[0]?.progressoAte);
  sourceId=log.id;sourceDate=log.data;
  if(ambiguous||value===null||!Number.isFinite(value)||value<0||value>100){progress=null;completedAt='';reason=ambiguous?'Diário ou atividade duplicados na data; reconfira a medição.':'Avanço acumulado inválido no diário revisado.';continue;}
  if(value===100&&progress!==100)completedAt=log.data;
  if(value<100)completedAt='';
  progress=value;reason='';
 }
 return {progress,completedAt,sourceId,sourceDate,reason};
}

/** Operational deadline facts only. A mutable date snapshot is not an EVM baseline. */
export function scheduleIndicators(data,{obraId,asOf}){
 if(!isFinancialDate(asOf))return {error:'Escolha uma data de referência válida.'};
 const earnedSchedule=scheduleSpi(data,{obraId,asOf});
 const plans=(data.planos||[]).filter(plan=>plan.obraId===obraId);
 const issues=[];
 if(plans.length!==1)return {error:'',version:SCHEDULE_INDICATORS_VERSION,rows:[],milestones:[],issues:[{source:obraId,date:'',message:plans.length?'Mais de um planejamento para a obra; escolha e reconcilie o plano na origem.':'Obra sem planejamento cadastrado.'}],available:false,reason:plans.length?'Planejamento ambíguo.':'Sem planejamento.',total:0,invalidDates:0,measured:0,coverage:null,overdue:0,unverified:0,completed:0,lateCompleted:0,upcoming:0,maxOpenDelay:null,finish:'',baselineFinish:'',finishDrift:null,baselineDate:'',spi:earnedSchedule.spi,earnedSchedule};
 const plan=plans[0],budget=productionBudget(data,obraId),tasks=(plan.tarefas||[]).filter(task=>!isSummary(task,budget)&&task.status!=='cancelado');
 const baselineUsable=isFinancialDate(plan.baselineData)&&plan.baselineData<=asOf;
 const baseline=baselineUsable?(plan.baseline||[]):[];
 const next=shiftDay(asOf,7);
 const rows=tasks.map(task=>{
  const identified=!!task.id&&tasks.filter(other=>other.id===task.id).length===1;
  const evidence=identified?diaryEvidence(data,obraId,task.id,asOf):{progress:null,completedAt:'',sourceId:'',sourceDate:'',reason:'Identificação ausente ou duplicada no planejamento.'};
  const valid=validRange(task)&&identified;
  const bases=baseline.filter(item=>item.tarefaId===task.id),base=bases.length===1&&validRange(bases[0])?bases[0]:null;
  const complete=evidence.progress===100,expired=valid&&task.fim<asOf;
  const state=!valid?'Datas ou identificação inválidas':evidence.progress===null?'Sem medição confirmada':complete?(evidence.completedAt>task.fim?'Concluída após o prazo':'Conclusão registrada no prazo'):expired?'Vencida com saldo a executar':task.fim===asOf?'Vence hoje':'Dentro da data vigente';
  const lateDays=valid&&complete?Math.max(0,days(task.fim,evidence.completedAt)):valid&&expired&&evidence.progress!==null?days(task.fim,asOf):null;
  const row={id:task.id,name:task.nome||task.id,start:task.inicio||'',finish:task.fim||'',valid,...evidence,state,lateDays,overdue:expired&&!complete&&evidence.progress!==null,unverified:expired&&evidence.progress===null,upcoming:valid&&!complete&&task.fim>=asOf&&task.fim<=next,baselineFinish:base?.fim||'',finishDrift:valid&&base?days(base.fim,task.fim):null};
  if(!valid||evidence.reason)issues.push({date:evidence.sourceDate,source:evidence.sourceId||task.id,message:`${row.name}: ${!valid?'Confira início, fim e identificação da atividade no Planejamento.':evidence.reason}`});
  if(row.overdue)issues.push({date:task.fim,source:task.id,message:`${row.name}: prazo vigente vencido há ${contar(lateDays,'dia corrido','dias corridos')}, com avanço confirmado de ${evidence.progress}%.`});
  return row;
 });
 const valid=rows.filter(row=>row.valid),allDated=rows.length>0&&valid.length===rows.length;
 const finish=allDated?valid.map(row=>row.finish).sort().at(-1):'';
 const baseComplete=allDated&&baseline.length===rows.length&&rows.every(row=>row.baselineFinish);
 const baselineFinish=baseComplete?rows.map(row=>row.baselineFinish).sort().at(-1):'';
 const milestones=(plan.marcos||[]).filter(item=>item.status!=='cancelado').map(item=>({id:item.id,name:item.nome||item.descricao||'Marco',date:item.data||'',state:!isFinancialDate(item.data)?'Data inválida':item.data<asOf?'Data passada · validar entrega':item.data<=next?'Próximos 7 dias':'Futuro'}));
 return {error:'',version:SCHEDULE_INDICATORS_VERSION,available:rows.length>0,reason:rows.length?'':'Planejamento sem atividades executivas.',planId:plan.id||'',rows,milestones,issues,total:rows.length,invalidDates:rows.filter(row=>!row.valid).length,measured:rows.filter(row=>row.progress!==null).length,coverage:rows.length?rows.filter(row=>row.progress!==null).length/rows.length:null,
  overdue:rows.filter(row=>row.overdue).length,unverified:rows.filter(row=>row.unverified).length,completed:rows.filter(row=>row.valid&&row.progress===100).length,lateCompleted:rows.filter(row=>row.valid&&row.progress===100&&row.lateDays>0).length,upcoming:rows.filter(row=>row.upcoming).length,maxOpenDelay:rows.some(row=>row.overdue)?Math.max(...rows.filter(row=>row.overdue).map(row=>row.lateDays)):null,finish,baselineFinish,finishDrift:finish&&baselineFinish?days(baselineFinish,finish):null,baselineDate:baselineUsable?plan.baselineData:'',spi:earnedSchedule.spi,earnedSchedule};
}
