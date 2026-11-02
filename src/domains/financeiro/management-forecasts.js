import {forecastCash,shiftDay} from './cash-forecast.js';
import {isFinancialDate} from './dates.js';
import {workStageCosts} from './work-stage-costs.js';
import {calcLedgerAcumulado} from './legacy-calculations.js';
import {safeReportText} from './report-export.js';

export const FORECAST_VERSION='2026-11-02.2';
const sum=(rows,key)=>rows.reduce((total,row)=>total+(row[key]||0),0);
export function weeksFrom(start){
  if(!isFinancialDate(start))throw new Error('Informe uma data de referência válida.');
  return Array.from({length:13},(_,index)=>({index:index+1,start:shiftDay(start,index*7),end:shiftDay(start,index*7+6)}));
}
export function cashThirteenWeeks(data,ledger,options){
  const weeks=weeksFrom(options.today),forecast=forecastCash(data,ledger,{...options,days:91});
  const rows=weeks.map((week,index)=>{
    const days=forecast.rows.slice(index*7,index*7+7);
    return {...week,incoming:sum(days,'incoming'),outgoing:sum(days,'outgoing'),opening:forecast.hasOpening?(index?forecast.rows[index*7-1].balance:forecast.openingCents):null,closing:days.at(-1).balance,lowest:forecast.hasOpening?Math.min(...days.map(day=>day.balance)):null,items:days.flatMap(day=>day.items)};
  });
  return {...forecast,weeks:rows,end:weeks.at(-1).end,incoming:sum(rows,'incoming'),outgoing:sum(rows,'outgoing'),fundingNeed:forecast.hasOpening?Math.max(0,-forecast.openingCents,-forecast.lowest.balance):null,beyondHorizon:(forecast.scheduled||[]).filter(item=>item.forecastDate>weeks.at(-1).end)};
}
export function costAtCompletion(data,{workIds,asOf}){
  return costForecastBundle(data,{workIds,asOf}).reports;
}
export function costForecastBundle(data,{workIds,asOf}){
  weeksFrom(asOf);
  const works=(data.obras||[]).filter(work=>workIds.includes(work.id));
  const accumulated=calcLedgerAcumulado(data,works.map(work=>work.id),Number(asOf.slice(0,4)),Number(asOf.slice(5,7))-1);
  const reports=works.map(work=>{
    const report=workStageCosts(data,accumulated.ledger,work.id,asOf),warnings=[];
    const missingHistory=(accumulated.missingStart||[]).includes(work.id)||!isFinancialDate(String(work.startDate||work.contractStart||'').slice(0,10));
    if(missingHistory)warnings.push('Início da obra ausente: custo acumulado de pessoal e equipamentos incompleto.');
    if(!report.budget)warnings.push('Sem orçamento de controle aprovado; restante e custo final não estão completos.');
    if(report.rows.some(row=>row.revision&&!row.reviewValid))warnings.push('Há revisão de custo com base alterada; reconfira os valores em Custos por etapa.');
    if(report.orphanRevisions.length)warnings.push('Há revisões de etapas fora do orçamento atual.');
    if(report.duplicationWarnings.length)warnings.push('Há indícios de sobreposição de estimativas; confira os avisos em Custos por etapa.');
    if(report.rows.some(row=>row.remaining+row.contingency+row.changeImpact<0))warnings.push('Impactos negativos superam o custo restante de uma etapa.');
    if(report.rows.some(row=>row.id==='unassigned'&&(row.incurred||row.openCommitted||row.revision)))warnings.push('Há valores sem apropriação por etapa; confirme a cobertura da estimativa.');
    const budgetItems=(report.budget?.itens||[]).filter(item=>item.tipo!=='titulo');
    const invalidBudget=!budgetItems.length||budgetItems.some(item=>[item.quantidade,item.precoUnit].some(value=>value==null||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)||!Number.isSafeInteger(Math.round(Number(item.quantidade)*Number(item.precoUnit)*100)));
    const stale=report.rows.some(row=>row.revision&&!row.reviewValid)||report.orphanRevisions.length>0;
    const unassignedUnreviewed=report.rows.some(row=>row.id==='unassigned'&&(row.incurred||row.openCommitted)&&!row.reviewValid);
    if(unassignedUnreviewed)warnings.push('Gastos ou compras sem etapa exigem apropriação ou revisão explícita antes do custo final; a referência automática pode sobrepor o orçamento.');
    const invalidAmounts=report.rows.some(row=>['budget','incurred','remaining','contingency','changeImpact','forecast'].some(key=>!Number.isSafeInteger(row[key]))||row.remaining<0||row.contingency<0||row.remaining+row.contingency+row.changeImpact<0||row.revision&&row.remaining<row.openCommitted);
    if(invalidBudget)warnings.push('Orçamento com quantidade, preço ou valor inválido: custo final indisponível.');
    if(invalidAmounts)warnings.push('Estimativa com valores inválidos ou restante abaixo das compras pendentes: reconfira a revisão.');
    const safeTotals=Object.values(report.totals).every(Number.isSafeInteger);
    if(!safeTotals)warnings.push('Totais fora do limite seguro de centavos: custo final indisponível.');
    const complete=Boolean(report.budget)&&!missingHistory&&!invalidBudget&&!invalidAmounts&&!stale&&!unassignedUnreviewed&&safeTotals;
    return {work,report,warnings,complete,forecast:complete?report.totals.forecast:null,deviation:complete?report.totals.deviation:null,status:stale||unassignedUnreviewed?'Reconferir estimativa':!complete?'Base incompleta':warnings.length?'Reconferir estimativa':report.rows.every(row=>!row.budget||row.reviewValid)?'Revisada':'Referência automática'};
  });
  return {...accumulated,reports};
}

const number=value=>value==null||String(value).trim()===''?null:Number(value);
const positive=value=>Number.isFinite(value)&&value>0;
export function laborDemand({asOf,start,end,hoursPerDay,workSaturday=false,excludedDates=[],services=[],roles={}}){
  const weeks=weeksFrom(asOf),issues=[],dayHours=number(hoursPerDay);
  if(!isFinancialDate(start)||!isFinancialDate(end)||start>end||start<asOf||end>weeks.at(-1).end)return {error:'Escolha um intervalo dentro das 13 semanas, com término igual ou posterior ao início.',issues,rows:[],groups:[],weeks:[]};
  if(!positive(dayHours)||dayHours>24)return {error:'Informe horas disponíveis por pessoa e dia entre zero e 24, sem incluir pausas.',issues,rows:[],groups:[],weeks:[]};
  const days=[];for(let date=start;date<=end;date=shiftDay(date,1)){const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();if(weekday!==0&&(workSaturday||weekday!==6)&&!excludedDates.includes(date))days.push(date);}
  if(!days.length)return {error:'O intervalo não possui dias no calendário selecionado.',issues,rows:[],groups:[],weeks:[]};
  const rows=services.map(service=>{
    const quantity=number(service.remainingQuantity),observedQuantity=number(service.observedQuantity),observedHours=number(service.observedHours);
    const coefficient=service.basis==='observed'&&positive(observedQuantity)&&positive(observedHours)?observedHours/observedQuantity:service.basis==='reference'?number(service.rup):null;
    const role=String(service.role||'').trim().normalize('NFC').toLocaleLowerCase('pt-BR'),problems=[];
    if(!service.name?.trim())problems.push('Serviço sem descrição.');
    if(!service.unit?.trim())problems.push('Unidade do serviço não informada.');
    if(quantity===null||!Number.isFinite(quantity)||quantity<0)problems.push('Quantidade restante não confirmada.');
    if(quantity!==0&&!positive(coefficient))problems.push(service.basis==='observed'?'Informe produção aceita e horas apropriadas do mesmo serviço.':'Informe uma RUP de referência positiva.');
    if(!role)problems.push('Função da equipe não informada.');
    const hours=problems.length?null:quantity===0?0:quantity*coefficient;
    if(hours!==null&&!Number.isFinite(hours))problems.push('Valores acima do limite de cálculo.');
    issues.push(...problems.map(message=>({serviceId:service.id,message})));
    return {...service,role,quantity,coefficient:positive(coefficient)?coefficient:null,hours:problems.length?null:hours,problems};
  });
  if(!rows.length)issues.push({message:'Adicione ao menos um serviço para dimensionar a equipe.'});
  const groups=[...new Set(rows.map(row=>row.role).filter(Boolean))].map(role=>{
    const selected=rows.filter(row=>row.role===role),partial=selected.some(row=>row.hours===null),hours=sum(selected,'hours'),setup=roles[role]||{};
    const available=number(setup.available),rate=number(setup.hourlyCost);
    const availableValid=Number.isInteger(available)&&available>=0,rateValid=Number.isFinite(rate)&&rate>=0;
    const capacity=availableValid?available*days.length*dayHours:null,people=partial?null:Math.ceil(hours/(days.length*dayHours));
    return {role,hours,partial,people,available:availableValid?available:null,capacity,deficit:!partial&&availableValid?Math.max(0,people-available):null,costCents:!partial&&(rateValid||hours===0)?Math.round(hours*(rate||0)*100):null};
  });
  let cumulativeDays=0;
  const weekly=weeks.map(week=>{
    const count=days.filter(date=>date>=week.start&&date<=week.end).length;
    const before=cumulativeDays;cumulativeDays+=count;
    return {...week,days:count,groups:groups.map(group=>({...group,hours:group.hours*count/days.length,capacity:group.available===null?null:group.available*count*dayHours,people:count?group.people:0,costCents:group.costCents===null?null:Math.round(group.costCents*cumulativeDays/days.length)-Math.round(group.costCents*before/days.length)}))};
  });
  return {error:'',issues,rows,groups,weeks:weekly,days:days.length,totalHours:sum(groups,'hours'),complete:rows.length>0&&!issues.length,priced:groups.length>0&&groups.every(group=>group.costCents!==null),costCents:sum(groups,'costCents')};
}

// Neutralize spreadsheet formulas and preserve the complete scenario in a native download.
export function forecastCsv(rows){return '\uFEFF'+rows.map(row=>row.map(value=>`"${(typeof value==='number'?String(value):safeReportText(value)).replaceAll('"','""')}"`).join(';')).join('\r\n');}
