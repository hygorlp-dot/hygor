import {scheduleIndicators} from './schedule-indicators.js';
import {productionBudget,productionHistory,dailyWorkforce,productionNumber} from '../diario-obra/production.js';
import {isFinancialDate} from '../financeiro/dates.js';
import {shiftDay} from '../financeiro/cash-forecast.js';
import {toCents} from '../financeiro/ledger.js';
import {calculatePPC,calculateProductivity} from '../planejamento/calculations.js';
import {applyProgressToCommitment} from '../producao/calculations.js';

export const PERFORMANCE_REPORT_VERSION='2026-11-02.2';
const sum=(rows,key)=>rows.reduce((total,row)=>total+(row[key]||0),0);
const dayCount=(start,end)=>Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000)+1;
const between=(day,start,end)=>isFinancialDate(day)&&day>=start&&day<=end;
export function reportWeek(day){
 const weekday=new Date(`${day}T12:00:00Z`).getUTCDay();
 const start=shiftDay(day,-((weekday+6)%7));return {start,end:shiftDay(start,6)};
}
function sampleStats(values){
 const count=values.length;
 if(!count)return {count,min:null,max:null,mean:null,sampleDeviation:null,variationCoefficient:null};
 const mean=values.reduce((a,b)=>a+b,0)/count;
 const variance=count>1?values.reduce((total,value)=>total+(value-mean)**2,0)/(count-1):null;
 const deviation=variance===null?null:Math.sqrt(variance);
 return {count,min:Math.min(...values),max:Math.max(...values),mean,sampleDeviation:deviation,variationCoefficient:count>1&&mean>0?deviation/mean:null};
}
function productivityRows(history,start,end){
 return history.services.flatMap(source=>{
  const samples=source.samples.filter(sample=>between(sample.date,start,end));
  return [...new Set(samples.flatMap(sample=>sample.allocations.filter(row=>row.hours>0).map(row=>row.role)))].map(role=>{
   const days=samples.map(sample=>({reportId:sample.reportId,date:sample.date,quantity:sample.quantity,hours:sum(sample.allocations.filter(row=>row.role===role),'hours'),points:sample.allocations.filter(row=>row.role===role).map(row=>({employeeId:row.employeeId,hours:row.hours})),sources:sample.allocations.filter(row=>row.role===role).map(row=>row.pointSource).join('; ')}));
   // A role absent on a day is not assigned that day's production.
   const presentDays=days.filter((row,index)=>samples[index].allocations.some(person=>person.role===role&&person.hours>0));
   const quantity=sum(presentDays,'quantity'),hours=sum(presentDays,'hours');
   const ratios=presentDays.filter(day=>day.quantity>0).map(day=>day.hours/day.quantity);
   return {id:`${source.item.id}:${role}`,itemId:source.item.id,name:source.item.descricao||source.item.nome||source.item.id,unit:source.item.unidade||'',role,quantity,hours,...calculateProductivity({quantity,workerHours:hours}),stats:sampleStats(ratios),days:presentDays,zeroProductionDays:presentDays.filter(day=>day.quantity===0).length,sourceIssues:source.issues};
  });
 });
}
function diaryCoverage(data,obraId,start,end,history){
 const dates=new Set();
 for(const days of Object.values(data.attendance||{}))for(const date of Object.keys(days||{}))if(between(date,start,end))dates.add(date);
 const logs=(data.rdos||[]).filter(log=>log.obraId===obraId&&between(log.data,start,end)&&log.status!=='cancelado');
 for(const log of logs)dates.add(log.data);
 const issues=[];const rows=[...dates].sort().map(date=>{
  const roster=dailyWorkforce(data,obraId,date),present=roster.filter(person=>['P','M'].includes(person.status));
  const complete=present.filter(person=>person.hours!==null),dayLogs=logs.filter(log=>log.data===date);
  const accepted=dayLogs.length===1&&dayLogs[0].status==='concluido'&&dayLogs[0].revisaoEngenheiro?.aprovado;
  const samples=history.services.flatMap(source=>source.samples.filter(sample=>sample.date===date));
  const linked=sum(samples.flatMap(sample=>sample.allocations),'hours'),known=sum(complete,'hours');
  const messages=[];
  if(present.length&&!dayLogs.length)messages.push('Diário não registrado para este dia com presença.');
  if(dayLogs.length>1)messages.push('Diários duplicados: produção não confirmada.');
  else if(dayLogs.length&&!accepted)messages.push('Diário aguarda revisão técnica e conclusão.');
  if(present.length>complete.length)messages.push('Presença com horários incompletos no ponto.');
  if(accepted&&!present.length)messages.push('Diário revisado sem presença confirmada no ponto carregado.');
  if(linked>known+0.00001)messages.push('Horas vinculadas superam a jornada disponível; confira a distribuição.');
  for(const person of roster.filter(person=>person.record&&['P','M'].includes(person.record.status)&&!person.status))messages.push(`Ponto pendente de conferência: ${person.name}.`);
  issues.push(...messages.map(message=>({date,message,source:dayLogs.map(log=>log.id).join(', ')||'ponto'})));
  return {hasPoint:roster.some(person=>person.record),date,present:present.length,completeHours:known,incompletePeople:present.length-complete.length,reviewed:Boolean(accepted),reportIds:dayLogs.map(log=>log.id).join(', '),linkedHours:linked,messages,pointSources:complete.map(person=>person.employeeId).join(', ')};
 }).filter(row=>row.hasPoint||row.reportIds);
 const expected=rows.filter(row=>row.present>0),reviewed=expected.filter(row=>row.reviewed);
 const knownHours=sum(rows,'completeHours'),linkedHours=sum(rows,'linkedHours');
 return {rows,issues,daysWithPresence:expected.length,reviewedDays:reviewed.length,ratio:expected.length?reviewed.length/expected.length:null,knownHours,linkedHours,linkedRatio:knownHours>0&&linkedHours<=knownHours+0.00001?linkedHours/knownHours:null,incompletePeopleDays:sum(rows,'incompletePeople')};
}
function physicalProgress(history,budget,data,obraId,asOf){
 if(!budget)return {rows:[],budgetCents:null,measuredCents:null,coverage:null,progress:null,measuredProgress:null,invalidBudget:true};
 let invalidBudget=false;
 const rows=history.services.map(source=>{
  const quantity=productionNumber(source.item.quantidade),price=productionNumber(source.item.precoUnit);
  const valid=quantity!==null&&price!==null&&Number.isFinite(quantity)&&Number.isFinite(price)&&quantity>=0&&price>=0&&Number.isSafeInteger(toCents(quantity*price));
  if(!valid)invalidBudget=true;
  const weight=valid?toCents(quantity*price):null;
  const last=source.records.at(-1),log=(data.rdos||[]).find(row=>row.id===last?.id&&row.obraId===obraId&&row.data<=asOf);
  const latest=(log?.servicos||[]).find(row=>row.budgetItemId===source.item.id),percent=productionNumber(latest?.progressoAte);
  const progress=source.remaining!==null&&quantity>0&&percent!==null&&Number.isFinite(percent)&&percent>=0&&percent<=100?(quantity-source.remaining)/quantity:null;
  return {id:source.item.id,name:source.item.descricao||source.item.nome||source.item.id,weight,progress,sourceId:last?.id||'',sourceDate:last?.date||'',issues:source.issues};
 });
 const positive=rows.filter(row=>row.weight>0),measured=positive.filter(row=>row.progress!==null);
 const total=sum(positive,'weight'),known=sum(measured,'weight'),earned=measured.reduce((value,row)=>value+row.weight*row.progress,0);
 return {rows,budgetCents:invalidBudget?null:total,measuredCents:known,coverage:!invalidBudget&&total>0?known/total:null,progress:!invalidBudget&&total>0&&measured.length===positive.length?earned/total:null,measuredProgress:known>0?earned/known:null,invalidBudget};
}
function weeklyReliability(data,obraId,start,end){
 const issues=[],groups=new Map();
 const selected=(data.weeklyCommitments||[]).filter(item=>item.obraId===obraId&&item.status!=='cancelado');
 for(const item of selected){
  if(!isFinancialDate(item.data)){issues.push({date:'',source:item.id,message:'Compromisso sem data válida; fora do cálculo semanal.'});continue;}
  const week=reportWeek(item.data);
  if(week.end<start||week.start>end)continue;
  if(!groups.has(week.start))groups.set(week.start,{...week,items:[],closed:week.end<=end,fullRange:week.start>=start&&week.end<=end});
  const promised=productionNumber(item.quantidadePrometida),validGoal=promised!==null&&Number.isFinite(promised)&&promised>0;
  const evidence=(data.progressRecords||[]).filter(record=>record.commitmentId===item.id&&record.obraId===obraId&&record.activityId===item.activityId&&record.status==='confirmado'&&between(record.data,'0001-01-01',end)&&Number.isFinite(Number(record.quantity))&&Number(record.quantity)>0);
  const onTime=evidence.filter(record=>record.data<=item.data),measured=applyProgressToCommitment(item,onTime);
  const allMeasured=applyProgressToCommitment(item,evidence);
  const blocked=item.status==='bloqueado';
  const done=validGoal&&measured.quantidadeRealizada>=promised&&!blocked;
  const failed=validGoal&&!done&&(item.status==='nao_concluido'||allMeasured.quantidadeRealizada>=promised)&&item.data<=end&&!blocked;
  const known=blocked||done||failed;
  const cause=failed?(item.motivoNaoCumprimento||'Entrega fora do prazo prometido ou motivo não registrado'):'';
  const status=blocked?'bloqueado':done?'concluido':failed?'nao_concluido':'aberto';
  const row={id:item.id,name:item.descricao||item.id,due:item.data,promised:validGoal?promised:null,producedOnTime:validGoal?measured.quantidadeRealizada:null,status,known,cause,evidenceIds:evidence.map(record=>record.id).join(', '),sourceStatus:item.status};
  groups.get(week.start).items.push(row);
  if(!validGoal)issues.push({date:item.data,source:item.id,message:'Meta inválida: fechamento do PPC indisponível.'});
  else if(!known&&week.end<=end)issues.push({date:item.data,source:item.id,message:'Compromisso de semana encerrada sem evidência datada suficiente ou fechamento de não cumprimento.'});
 }
 const weeks=[...groups.values()].sort((a,b)=>a.start.localeCompare(b.start)).map(week=>{
  const result=calculatePPC(week.items.map(row=>({...row,motivoNaoCumprimento:row.cause})));
  const pending=week.items.filter(row=>!row.known).length;
  return {...week,...result,pending,value:week.closed&&week.fullRange&&!pending&&result.total>0?result.ppc:null,state:!week.closed?'Em andamento':!week.fullRange?'Semana fora do recorte completo':pending?'Fechamento pendente':result.total?'Encerrada':'Somente bloqueados'};
 });
 const completedWeeks=weeks.filter(week=>week.value!==null),total=sum(completedWeeks,'total'),completed=sum(completedWeeks,'completed');
 return {weeks,issues,total,completed,value:total?completed/total:null,coveredWeeks:completedWeeks.length,partial:weeks.some(week=>week.closed&&week.fullRange&&week.value===null&&week.total>0)};
}

export function workPerformanceReport(data,{obraId,start,end}){
 if(!isFinancialDate(start)||!isFinancialDate(end)||start>end||dayCount(start,end)>366)return {error:'Escolha um período válido de até 366 dias, encerrado na data de referência.'};
 if(!(data.obras||[]).some(work=>work.id===obraId))return {error:'Selecione uma obra disponível.'};
 const budget=productionBudget(data,obraId),issues=[];
 const validLogs=(data.rdos||[]).filter(log=>log.obraId!==obraId||isFinancialDate(log.data));
 for(const log of data.rdos||[])if(log.obraId===obraId&&!isFinancialDate(log.data))issues.push({date:'',source:log.id,message:'Diário sem data válida; não entrou nos indicadores.'});
 const scoped={...data,rdos:validLogs},history=productionHistory(scoped,obraId,end,budget);
 const duration=dayCount(start,end),previousEnd=shiftDay(start,-1),previousStart=shiftDay(start,-duration);
 const current=productivityRows(history,start,end),previous=productivityRows(history,previousStart,previousEnd);
 const productivity=current.map(row=>{
  const prior=previous.find(item=>item.id===row.id),reference=prior?.hhPerUnit;
  return {...row,previousRup:reference??null,change:row.hhPerUnit!==null&&reference>0?(row.hhPerUnit/reference)-1:null};
 });
 const coverage=diaryCoverage(scoped,obraId,start,end,history),physical=physicalProgress(history,budget,scoped,obraId,end),planning=weeklyReliability(data,obraId,start,end);
 const schedule=scheduleIndicators(data,{obraId,asOf:end});
 issues.push(...coverage.issues,...planning.issues);
 for(const source of history.services){
  for(const message of source.issues)issues.push({date:'',source:source.item.id,message});
  if(!source.records.length)issues.push({date:'',source:source.item.id,message:'Item sem avanço acumulado revisado na base atual.'});
 }
 return {error:'',version:PERFORMANCE_REPORT_VERSION,obraId,start,end,previousStart,previousEnd,budgetId:budget?.id||'',productivity,coverage,physical,planning,schedule,issues};
}

export function workPerformanceCsv(report){
 return [['Relatório','Indicadores da obra'],['Metodologia',report.version],['Período',`${report.start} a ${report.end}`],['Comparação',`${report.previousStart} a ${report.previousEnd}`],['Base','Cadastros atuais; não reconstrói o que era conhecido no passado'],['Orçamento',report.budgetId],['Avanço total ponderado',report.physical.progress],['Cobertura do orçamento medido',report.physical.coverage],['Diários revisados / dias com presença',report.coverage.ratio],['Horas vinculadas / horas completas de ponto',report.coverage.linkedRatio],['PPC nas semanas completas encerradas com fechamento',report.planning.value],[],
 ['Serviço','Item','Unidade','Função','Quantidade na amostra','Horas-pessoa','RUP Hh/unidade','Unidades/Hh','Dias com produção','Mínimo RUP diária','Máximo RUP diária','Desvio amostral RUP diária','CV RUP diária','RUP anterior','Variação relativa da RUP','Dias com produção zero'],...report.productivity.map(row=>[row.name,row.itemId,row.unit,row.role,row.quantity,row.hours,row.hhPerUnit,row.productivity,row.stats.count,row.stats.min,row.stats.max,row.stats.sampleDeviation,row.stats.variationCoefficient,row.previousRup,row.change,row.zeroProductionDays]),[],
 ['Data','Diário','Item','Função','Produção do dia na amostra','Horas na amostra','Ponto de origem'],...report.productivity.flatMap(row=>row.days.map(day=>[day.date,day.reportId,row.itemId,row.role,day.quantity,day.hours,day.sources])),[],
 ['Data','Dias com presença: pessoas','Horas completas','Horas vinculadas em amostras válidas','Diário revisado','Diários de origem','Pendências'],...report.coverage.rows.map(row=>[row.date,row.present,row.completeHours,row.linkedHours,row.reviewed?'Sim':'Não',row.reportIds,row.messages.join(' ')]),[],
 ['Item do orçamento','Descrição','Peso em centavos','Avanço acumulado','Diário de origem','Data da medição'],...report.physical.rows.map(row=>[row.id,row.name,row.weight,row.progress,row.sourceId,row.sourceDate]),[],
 ['Início da semana','Fim da semana','PPC','Elegíveis','Concluídos no prazo','Bloqueados fora da base','Pendentes','Situação'],...report.planning.weeks.map(week=>[week.start,week.end,week.value,week.total,week.completed,week.blocked,week.pending,week.state]),[],
 ['Semana','Compromisso','Descrição','Data prometida','Meta','Produzido no prazo','Classificação','Status de origem','Motivo','Avanços de origem'],...report.planning.weeks.flatMap(week=>week.items.map(row=>[week.start,row.id,row.name,row.due,row.promised,row.producedOnTime,row.status,row.sourceStatus,row.cause,row.evidenceIds])),[],
 ['SPI · versão aprovada',report.schedule.earnedSchedule.baselineId],['Valor planejado em centavos',report.schedule.earnedSchedule.pv],['Valor agregado em centavos',report.schedule.earnedSchedule.ev],['SPI',report.schedule.spi],['Limite SPI',report.schedule.earnedSchedule.reason],['Item SPI','Atividade','Orçado em centavos','PV em centavos','EV em centavos','Avanço revisado %','Diário','Data','Motivo'],...report.schedule.earnedSchedule.rows.map(item=>[item.id,item.taskId,item.budgetCents,item.plannedCents,item.earnedCents,item.progress,item.sourceId,item.sourceDate,item.reason]),[],
 ['Prazo por atividade · posição na referência',report.end],['Atividade','Identificação','Início','Fim','Avanço revisado %','Situação','Dias corridos de atraso','Diário','Data da medição','Fim da base salva','Desvio da data em dias corridos'],...report.schedule.rows.map(item=>[item.name,item.id,item.start,item.finish,item.progress,item.state,item.lateDays,item.sourceId,item.sourceDate,item.baselineFinish,item.finishDrift]),[],
 ['Marcos do planejamento','Identificação','Data','Situação'],...report.schedule.milestones.map(item=>[item.name,item.id,item.date,item.state]),[],
 ['Limites de prazo','Datas vigentes e medição acumulada revisada até a referência. Dias corridos; ausência de medição não é atraso confirmado. Base salva pode ser substituída; não é SPI nem previsão de término.'],
 ['Data','Origem','Pendência'],...[...report.issues,...report.schedule.issues].map(issue=>[issue.date,issue.source,issue.message]),
 ['Regras','Taxas e proporções no CSV usam escala 0 a 1. CV é desvio amostral / média simples das RUP diárias; exclui dias de produção zero apenas da dispersão. RUP agregada mantém suas horas. Não somar quantidades de unidades diferentes nem produção duplicada por função. PPC mantém bloqueados separados, conforme cadastro inicial restrito do Planejamento.'],['Calendário da cobertura','Somente dias com presença confirmada no ponto; não representa todos os dias previstos da obra.']];
}
