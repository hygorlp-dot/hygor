import {managementKpis,managementKpiTotals} from './management-kpis.js';
import {executiveDecisions} from './executive-decisions.js';
import {costForecastBundle,cashThirteenWeeks,laborDemand,FORECAST_VERSION} from './management-forecasts.js';
import {selectDRE,selectCashFlow,selectAccountsPayable,selectAccountsReceivable,selectCommitments} from './ledger.js';
import {financialEntry,positionEntries} from './workspace.js';
import {reportCategoryLabel} from './report-center.js';
import {isFinancialDate} from './dates.js';
import {shiftDay} from './cash-forecast.js';
import {dailyLaborForecast} from './daily-labor-forecast.js';
import {workPerformanceReport} from '../obras/performance-reports.js';
import {laborCostsByRole,thirdPartyCosts,workforceCostEvolution} from './workforce-cost-breakdown.js';
import {contar} from '../../design-system/copy.js';
import {avancoFisicoOficial} from '../dre/calculations.js';

export const EXECUTIVE_REPORT_VERSION='2026-11-02.7';
const sum=(rows,key)=>rows.reduce((total,row)=>total+(row[key]??0),0);
const signed=event=>event.amountCents*(event.effect.endsWith('_reversal')?-1:1);
const validMoney=value=>Number.isSafeInteger(value);
const monthsBetween=(start,end)=>{
 const result=[];for(let month=start.slice(0,7);month<=end.slice(0,7);){result.push(month);const y=Number(month.slice(0,4)),m=Number(month.slice(5,7));month=m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,'0')}`;}return result;
};
function costEntries(data,events){return events.filter(event=>['cost','cost_reversal'].includes(event.effect)).map(event=>({...financialEntry(data,event),amountCents:signed(event),categoryLabel:reportCategoryLabel(event.category),reversal:event.effect==='cost_reversal'}));}
function groupCosts(entries){
 const groups=new Map();for(const entry of entries){const id=entry.category||'unclassified',group=groups.get(id)||{id,label:entry.categoryLabel,amountCents:0,count:0};group.amountCents+=entry.amountCents;group.count++;groups.set(id,group);}
 return [...groups.values()].sort((a,b)=>b.amountCents-a.amountCents||a.label.localeCompare(b.label,'pt-BR'));
}

// A single canonical ledger supports the whole dossier. Costs, cash payments,
// and open positions are parallel views of facts, never additive components.
export function executiveWorkReport(data,{workIds,asOf,start,openingCents=null,includeCompany=false,generatedAt=new Date().toISOString()}){
 if(!isFinancialDate(asOf)||!isFinancialDate(start)||start>asOf||monthsBetween(start,asOf).length>12)return {error:'Escolha um período válido de até 12 competências, encerrado na referência.'};
 const allowed=[...new Set(workIds)],works=(data.obras||[]).filter(work=>allowed.includes(work.id));
 if(!works.length)return {error:'Selecione uma obra disponível para o relatório.'};
 const bundle=costForecastBundle(data,{workIds:works.map(work=>work.id),asOf}),{ledger}=bundle;
 const issues=[];
 const rows=bundle.reports.map(cost=>{
  const id=cost.work.id,scoped={obraId:id,endDate:asOf.slice(0,7)},dre=selectDRE(ledger,scoped);
  const period=selectDRE(ledger,{obraId:id,startDate:start.slice(0,7),endDate:asOf.slice(0,7)});
  const cash=selectCashFlow(ledger,{obraId:id,startDate:start,endDate:asOf});
  const paidToDate=selectCashFlow(ledger,{obraId:id,endDate:asOf});
  const entries=costEntries(data,dre.events),periodEntries=costEntries(data,period.events);
  const payments=[...cash.events,...cash.thirdPartyEvents].filter(event=>event.effect!=='cash_in').map(event=>({...financialEntry(data,event),direct:event.effect==='third_party_payment'}));
  const payable=positionEntries(data,selectAccountsPayable(ledger,{obraId:id,asOfDate:asOf}));
  const receivable=positionEntries(data,selectAccountsReceivable(ledger,{obraId:id,asOfDate:asOf}));
  const roleCosts=laborCostsByRole(data,id,entries),thirdParties=thirdPartyCosts(data,id,entries,payments,payable);
  const workforceEvolution=workforceCostEvolution(data,id,entries,{start,end:asOf});
  const forecast=cashThirteenWeeks(data,ledger,{today:asOf,obraId:id});
  const performance=workPerformanceReport(data,{obraId:id,start,end:asOf});
  const laborSource=dailyLaborForecast(data,{obraId:id,asOf,budget:cost.report.budget});
  const labor=laborDemand({...laborSource,asOf});
  const warnings=[...cost.warnings];
  if(!roleCosts.reconciled)warnings.push('Detalhamento por função não conciliado com a mão de obra do razão.');
  if(roleCosts.unclassifiedCents)warnings.push('Parte do custo de pessoal não possui função histórica discriminada; consulte as linhas sem função.');
  const reconciled=sum(entries,'amountCents')===cost.report.totals.incurred;
  if(!reconciled)warnings.push('Divergência entre memória de gastos e custo por etapa: custo final indisponível.');
  const moneyOk=[dre.costCents,dre.revenueCents,period.costCents,...entries.map(entry=>entry.amountCents),...Object.values(cost.report.totals)].every(validMoney);
  if(!moneyOk)warnings.push('Valores fora do limite de centavos inteiros: custo final indisponível.');
  if(cost.report.rows.some(row=>row.id==='unassigned'&&row.incurred))warnings.push('Há gastos sem etapa: revisar a apropriação.');
  if(forecast.overdue.length)warnings.push(`${contar(forecast.overdue.length,'título vencido separado','títulos vencidos separados')} do caixa futuro.`);
  if(forecast.undated.length)warnings.push(`${contar(forecast.undated.length,'título','títulos')} sem vencimento válido fora do caixa previsto.`);
  if(!labor.complete||laborSource.issues.length)warnings.push('Previsão de mão de obra com pendências de origem ou cobertura parcial.');
  const physical=performance.physical?.progress??null;
  // Avanço da DRE e do painel (medição técnica aprovada ou percentual de
  // cobrança), mostrado ao lado do avanço pelo diário; não entra no CPI.
  const officialPercent=avancoFisicoOficial(data,cost.work.id),officialPhysical=officialPercent==null?null:officialPercent/100;
  const monthEnd=shiftDay(asOf,1).slice(0,7)!==asOf.slice(0,7);
  const comparable=monthEnd&&cost.complete&&reconciled&&moneyOk&&physical!==null&&cost.report.totals.budget===performance.physical.budgetCents&&!cost.report.rows.some(row=>row.id==='unassigned'&&row.incurred);
  const earned=comparable?Math.round(cost.report.totals.budget*physical):null;
  const cpi=earned!==null&&dre.costCents>0?earned/dre.costCents:null;
  const complete=cost.complete&&reconciled&&moneyOk;
  const row={schedule:performance.schedule,work:cost.work,cost,entries,periodEntries,categories:groupCosts(entries),periodCategories:groupCosts(periodEntries),payments,payable,receivable,forecast,performance,laborSource,labor,roleCosts,thirdParties,workforceEvolution,
   incurred:dre.costCents,periodCost:period.costCents,revenue:period.revenueCents,result:period.resultCents,margin:period.revenueCents>0?period.resultCents/period.revenueCents:null,
   paid:paidToDate.cashOutCents,clientPaid:paidToDate.thirdPartyPaidCents,periodPaid:cash.cashOutCents,periodClientPaid:cash.thirdPartyPaidCents,received:cash.cashInCents,
   finalCost:complete?cost.forecast:null,deviation:complete?cost.deviation:null,deviationRatio:complete&&cost.report.totals.budget>0?cost.deviation/cost.report.totals.budget:null,
   budget:cost.report.budget&&validMoney(cost.report.totals.budget)?cost.report.totals.budget:null,physical,officialPhysical,cpi,earned,cpiReason:comparable?'':!monthEnd?'Custos mensais e avanço diário têm cortes diferentes; consulte no último dia do mês.':'Falta medição integral, orçamento comparável, custo completo ou apropriação por etapa.',reconciled,warnings:[...new Set(warnings)]};
  const commitments=positionEntries(data,selectCommitments(ledger,{obraId:id,asOfDate:asOf}));
  row.managementKpis=managementKpis({receivable,payable,commitments,asOf,incurred:row.incurred,earned,finalCost:row.finalCost,budget:row.budget,cpiReason:row.cpiReason});
  issues.push(...row.warnings.map(message=>({obraId:id,work:cost.work.name,message})));return row;
 });
 const ids=new Set(works.map(work=>work.id)),scopedLedger={events:ledger.events.filter(event=>ids.has(event.obraId)),issues:ledger.issues};
 const cash=cashThirteenWeeks(data,scopedLedger,{today:asOf,openingCents});
 const allComplete=rows.every(row=>row.finalCost!==null);
 const totals={incurred:sum(rows,'incurred'),periodCost:sum(rows,'periodCost'),periodPaid:sum(rows,'periodPaid'),periodClientPaid:sum(rows,'periodClientPaid'),revenue:sum(rows,'revenue'),result:sum(rows,'result'),received:sum(rows,'received'),
  budget:rows.every(row=>row.budget!==null)?sum(rows,'budget'):null,knownBudget:sum(rows,'budget'),finalCost:allComplete?sum(rows,'finalCost'):null,knownFinalCost:sum(rows,'finalCost'),deviation:allComplete?sum(rows,'deviation'):null,completeWorks:rows.filter(row=>row.finalCost!==null).length,workCount:rows.length};
 totals.margin=totals.revenue>0?totals.result/totals.revenue:null;
 const trend=monthsBetween(start,asOf).map(month=>{const events=scopedLedger.events.filter(event=>event.competence===month);const dre=selectDRE({events},{endDate:month});const flows=selectCashFlow(scopedLedger,{startDate:month===start.slice(0,7)?start:`${month}-01`,endDate:month===asOf.slice(0,7)?asOf:shiftDay(`${Number(month.slice(5,7))===12?Number(month.slice(0,4))+1:month.slice(0,4)}-${Number(month.slice(5,7))===12?'01':String(Number(month.slice(5,7))+1).padStart(2,'0')}-01`,-1)});return {month,cost:dre.costCents,revenue:dre.revenueCents,result:dre.resultCents,paid:flows.cashOutCents,received:flows.cashInCents};});
 const companyCost=includeCompany?selectDRE({events:ledger.events.filter(event=>!event.obraId)},{startDate:start.slice(0,7),endDate:asOf.slice(0,7)}).costCents:null;
 for(const issue of ledger.issues||[])if(ids.has(issue.obraId)||includeCompany&&!issue.obraId)issues.push({obraId:issue.obraId||'',work:works.find(work=>work.id===issue.obraId)?.name||'Base financeira',message:issue.message||issue.code||'Pendência do razão financeiro.'});
 return {error:'',version:EXECUTIVE_REPORT_VERSION,forecastVersion:FORECAST_VERSION,start,asOf,generatedAt,rows,totals,managementKpis:managementKpiTotals(rows),cash,trend,companyCost,includeCompany,issues,source:'Base atual carregada do ERP. Custos por competência até o mês da referência; caixa realizado até a data. Sem reconstrução histórica nem rateio automático de despesas da empresa.'};
}

export function executiveReportSheets(report){
 const amount=value=>value==null||!validMoney(value)?'Não disponível':value/100;
 const sheets={
  Recorte:[['Relatório','Relatório executivo por obra'],['Versão',report.version],['Gerado em',report.generatedAt],['Período',`${report.start} a ${report.asOf}`],['Custos','Competências mensais inteiras do período; acumulado desde a origem carregada até o mês de referência'],['Caixa','Datas efetivas no período; títulos em aberto na data de referência'],['Fonte',report.source],['Cobertura custo final',`${report.totals.completeWorks} de ${report.totals.workCount} obras calculáveis`],['Despesas da empresa sem rateio no período (R$)',amount(report.companyCost)],['Limites','Custo, pagamento, compromisso e recebimento físico não são somados. Margem realizada não é lucro final do contrato. Proporções em escala 0 a 1.'] ],
  Carteira:[['Obra','Orçamento R$','Incorrido acumulado R$','Custo do período R$','Pago no período R$','Cliente direto no período R$','Custo final R$','Desvio R$','Avanço pelo diário','Avanço oficial da medição','PPC verificado','Margem realizada','CPI','Base'],...report.rows.map(row=>[row.work.name,amount(row.budget),amount(row.incurred),amount(row.periodCost),amount(row.periodPaid),amount(row.periodClientPaid),amount(row.finalCost),amount(row.deviation),row.physical,row.officialPhysical,row.performance.planning?.value??null,row.margin,row.cpi,row.finalCost===null?'Base pendente':row.cost.status])],
  Categorias:[['Obra','Categoria','Incorrido acumulado R$','Eventos'],...report.rows.flatMap(row=>row.categories.map(category=>[row.work.name,category.label,amount(category.amountCents),category.count]))],
  Funções:[['Obra','Função','Mão de obra e encargos R$','Benefícios R$','Total incorrido R$','Base','Eventos de origem'],...report.rows.flatMap(row=>row.roleCosts.rows.map(item=>[row.work.name,item.role,amount(item.laborCents),amount(item.benefitCents),amount(item.totalCents),item.source,item.origins]))],
  Terceirizados:[['Obra','Prestador','Contrato','Especialidade','Incorrido acumulado R$','Pago no período R$','Cliente direto no período R$','Saldo a pagar R$','Base','Eventos de origem'],...report.rows.flatMap(row=>row.thirdParties.map(item=>[row.work.name,item.name,item.contractId,item.specialty,amount(item.incurred),amount(item.paid),amount(item.clientPaid),amount(item.payable),item.hasCost?'Custo reconhecido':'Sem custo reconhecido nas fontes',item.origins]))],
  'Evolução pessoal':[['Obra','Tipo','Competência','Função / prestador','Custo registrado R$','Base','Eventos de origem'],...report.rows.flatMap(row=>[...row.workforceEvolution.roleMonths.map(item=>({...item,type:'Equipe por função'})),...row.workforceEvolution.thirdMonths.map(item=>({...item,type:'Terceirizado'}))].map(item=>[row.work.name,item.type,item.month,item.label,amount(item.amountCents),item.source,item.origins]))],
  'Comparação pessoal':[['Obra','Tipo','Função / prestador','Período atual','Período anterior','Atual R$','Anterior R$','Diferença R$','Variação relativa','Situação','Eventos de origem'],...report.rows.flatMap(row=>[...row.workforceEvolution.roles.map(item=>({...item,type:'Equipe por função'})),...row.workforceEvolution.thirdParties.map(item=>({...item,type:'Terceirizado'}))].map(item=>[row.work.name,item.type,item.label,`${row.workforceEvolution.currentStart} a ${row.workforceEvolution.currentEnd}`,`${row.workforceEvolution.previousStart} a ${row.workforceEvolution.previousEnd}`,amount(item.currentCents),amount(item.previousCents),amount(item.difference),item.change,row.workforceEvolution.completeMonths?'Competências encerradas; base atual carregada':'Referência em andamento; comparação indisponível',item.origins]))],
  Inadimplência:[['Obra','Tipo','Referência','Documento / origem','Vencimento','Saldo R$','Faixa','Percentual vencido sobre saldos datados','Títulos sem vencimento'],...report.rows.flatMap(row=>[[row.work.name,'Resumo',report.asOf,'','',amount(row.managementKpis.receivables.overdueCents),'Vencido a receber',row.managementKpis.receivables.ratio,row.managementKpis.receivables.undatedCount],...row.managementKpis.receivables.titles.map(item=>[row.work.name,'Título',report.asOf,`${item.documentNumber||''} / ${item.sourceType}:${item.sourceId}`,item.dueDate||'Sem vencimento válido',amount(item.amountCents),item.bucket,'',''])])],
  Compromissos:[['Obra','Tipo','Referência','Origem','Descrição','Compras a faturar R$','Títulos a pagar R$'],...report.rows.flatMap(row=>[[row.work.name,'Resumo',report.asOf,'','Posições distintas; não somar ao custo final',amount(row.managementKpis.purchases.openCents),amount(row.managementKpis.purchases.payableCents)],...row.managementKpis.purchases.items.map(item=>[row.work.name,'Compra a faturar',report.asOf,`${item.sourceType}:${item.sourceId}`,item.description,amount(item.amountCents),''])])],
  'Variação custo':[['Obra','Referência','Valor agregado R$','Custo incorrido R$','CV R$ (agregado menos incorrido)','VAC R$ (orçamento menos custo final)','Base CV','Base VAC'],...report.rows.map(row=>[row.work.name,report.asOf,amount(row.managementKpis.variance.earned),amount(row.managementKpis.variance.actual),amount(row.managementKpis.variance.cv),amount(row.managementKpis.variance.vac),row.managementKpis.variance.reason||'Mesmo corte e escopo',row.managementKpis.variance.forecastReason||'Previsão disponível'])],
  Etapas:[['Obra','Etapa','Orçado R$','Incorrido R$','Compras a faturar incluídas R$','Restante R$','Risco R$','Mudanças R$','Estimativa R$','Base'],...report.rows.flatMap(row=>row.cost.report.rows.map(stage=>[row.work.name,stage.label,amount(stage.budget),amount(stage.incurred),amount(stage.openCommitted),amount(stage.remaining),amount(stage.contingency),amount(stage.changeImpact),row.finalCost!==null?amount(stage.forecast):'Subtotal pendente',stage.reviewValid?'Revisada':stage.revision?'Reconferir':'Automática']))],
  Evolução:[['Competência','Receita R$','Custo R$','Resultado R$','Pago por data R$','Recebido por data R$'],...report.trend.map(row=>[row.month,amount(row.revenue),amount(row.cost),amount(row.result),amount(row.paid),amount(row.received)])],
  Caixa:[['Semana','Início','Fim','Entradas R$','Saídas R$','Saldo final R$','Menor saldo R$'],...report.cash.weeks.map(week=>[week.index,week.start,week.end,amount(week.incoming),amount(week.outgoing),amount(week.closing),amount(week.lowest)]),['Saldo inicial R$',amount(report.cash.openingCents)],['Necessidade máxima R$',amount(report.cash.fundingNeed)],['Vencidos separados',report.cash.overdue.length],['Sem vencimento',report.cash.undated.length],['Além do horizonte',report.cash.beyondHorizon.length]],
  Equipe:[['Obra','Função','Horas restantes Hh','Pessoas necessárias','Última equipe observada','Déficit de pessoas','Custo estimado R$','Base'],...report.rows.flatMap(row=>row.labor.groups.map(group=>[row.work.name,group.role,group.partial?null:group.hours,group.people,group.available,group.deficit,amount(group.costCents),group.partial?'Parcial':'Paramétrica; disponibilidade futura não confirmada']))],
  SPI:[['Obra','Referência','Versão aprovada','Aprovação','Orçamento congelado R$','PV R$','EV R$','SPI EV/PV','SV R$','Cobertura','Motivo'],...report.rows.map(row=>{const s=row.schedule.earnedSchedule;return [row.work.name,report.asOf,s.baselineId,s.approvedAt,amount(s.budgetCents),amount(s.pv),amount(s.ev),s.spi,amount(s.sv),s.coverage,s.reason]})],
  'SPI itens':[['Obra','Versão','Item','Atividade','Início congelado','Fim congelado','Orçado R$','PV R$','EV R$','Avanço revisado %','Diário','Data da medição','Dias trabalhados previstos','Dias trabalhados até referência','Base'],...report.rows.flatMap(row=>row.schedule.earnedSchedule.rows.map(item=>[row.work.name,row.schedule.earnedSchedule.baselineId,item.id,item.taskId,item.start,item.finish,amount(item.budgetCents),amount(item.plannedCents),amount(item.earnedCents),item.progress,item.sourceId,item.sourceDate,item.plannedDays,item.elapsedDays,item.reason]))],
  Prazos:[['Obra','Referência','Atividades','Datas ou identificação inválidas','Medidas pelo diário','Cobertura','Vencidas com saldo confirmado','Vencidas sem medição','Concluídas','Concluídas após prazo','Vencem próximos 7 dias','Maior atraso aberto em dias corridos','Fim vigente das atividades','Fim da base salva','Desvio do fim em dias corridos','Data da fotografia da base','Limite'],...report.rows.map(row=>[row.work.name,report.asOf,row.schedule.total,row.schedule.invalidDates,row.schedule.measured,row.schedule.coverage,row.schedule.overdue,row.schedule.unverified,row.schedule.completed,row.schedule.lateCompleted,row.schedule.upcoming,row.schedule.maxOpenDelay,row.schedule.finish,row.schedule.baselineFinish,row.schedule.finishDrift,row.schedule.baselineDate,row.schedule.reason||'Datas vigentes; base substituível; não é previsão do término nem SPI'])],
  'Atividades prazo':[['Obra','Atividade','Identificação','Início vigente','Fim vigente','Avanço revisado %','Situação','Dias corridos de atraso','Diário','Data da medição','Fim da base salva','Desvio da data em dias corridos'],...report.rows.flatMap(row=>row.schedule.rows.map(item=>[row.work.name,item.name,item.id,item.start,item.finish,item.progress,item.state,item.lateDays,item.sourceId,item.sourceDate,item.baselineFinish,item.finishDrift]))],
  'Marcos prazo':[['Obra','Marco','Identificação','Data','Situação'],...report.rows.flatMap(row=>row.schedule.milestones.map(item=>[row.work.name,item.name,item.id,item.date,item.state]))],
  Indicadores:[['Obra','Avanço pelo diário','Avanço oficial da medição','Cobertura do orçamento medido','PPC semanas verificadas','Diários revisados / presença','Hh apropriadas / completas','CPI','Limite CPI'],...report.rows.map(row=>[row.work.name,row.physical,row.officialPhysical,row.performance.physical?.coverage??null,row.performance.planning?.value??null,row.performance.coverage?.ratio??null,row.performance.coverage?.linkedRatio??null,row.cpi,row.cpiReason])],
  Produtividade:[['Obra','Serviço','Função','Unidade','Produção','Hh','RUP Hh/unidade','RUP anterior','Variação relativa','Dias','Desvio amostral','CV','Diários'],...report.rows.flatMap(row=>(row.performance.productivity||[]).map(item=>[row.work.name,item.name,item.role,item.unit,item.quantity,item.hours,item.hhPerUnit,item.previousRup,item.change,item.stats.count,item.stats.sampleDeviation,item.stats.variationCoefficient,item.days.map(day=>day.reportId).join(', ')]))],
  Gastos:[['Obra','Competência','Data do fato','Categoria','Descrição','Contraparte','Documento','Custo líquido R$','Origem','Registro','Evento','Estorno'],...report.rows.flatMap(row=>row.entries.map(entry=>[row.work.name,entry.competence,entry.date,entry.categoryLabel,entry.description,entry.counterparty,entry.documentNumber,amount(entry.amountCents),entry.sourceType,entry.sourceId,entry.id,entry.reversal?'Sim':'Não']))],
  Pagamentos:[['Obra','Data','Descrição','Valor R$','Forma','Origem','Registro','Evento'],...report.rows.flatMap(row=>row.payments.map(entry=>[row.work.name,entry.date,entry.description,amount(entry.amountCents),entry.direct?'Cliente direto ao fornecedor':'Saída de caixa',entry.sourceType,entry.sourceId,entry.id]))],
  Títulos:[['Obra','Direção','Vencimento','Descrição','Saldo R$','Origem','Registro'],...report.rows.flatMap(row=>[...row.payable.map(item=>({...item,direction:'A pagar'})),...row.receivable.map(item=>({...item,direction:'A receber'}))].map(item=>[row.work.name,item.direction,item.dueDate||'Sem vencimento',item.description,amount(item.amountCents),item.sourceType,item.sourceId]))],
  Pendências:[['Obra','Área','Data','Registro','Pendência','Providência'],...executiveDecisions(report).map(item=>[item.work,item.area,item.date,item.source,item.message,item.action])],
 };
 return sheets;
}
export const executiveReportCsvRows=report=>Object.entries(executiveReportSheets(report)).flatMap(([name,rows])=>[[name],...rows,[]]);
