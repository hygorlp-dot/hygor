import {readWorkAdministrationProjection} from './dre-projection.js';
import {createLaborCostEngine} from '../src/domains/financeiro/labor-cost-engine.js';
import {getDays,getAtt,getPayrollHolidays,getHolidayPayRule,isEmployeeEmployedOnDate,prIsWeekdayIso} from '../src/domains/ponto/attendance-engine.js';
import {resolveEmployeeAttendanceObraId} from '../src/domains/ponto/permissions.js';
import {remunerationModeOnDate} from '../src/domains/rh/remuneration-mode.js';
import {calculateLaborProvision,newProvisionDraft} from '../src/domains/ponto/labor-provisions.js';
import {allocateNetByWork} from '../src/domains/ponto/payroll-closing.js';
import {active,toCents} from '../src/domains/financeiro/facts.js';
import {clientContractMeasurements} from './client-portal-contract.js';
import {uniquePortalRecords} from './client-portal-records.js';
import {includedLaborProvisionFactor} from '../src/domains/financeiro/labor-charges.js';
import {workforceReserveConfig,calculateWorkforceReserve} from '../src/domains/financeiro/workforce-reserve.js';

const money=value=>toCents(value)/100;
export function clientTeamMonth(value,asOf){
 const month=value||asOf.slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month>asOf.slice(0,7))throw Object.assign(new Error('Escolha um mês válido até o mês atual.'),{status:400});
 return month;
}
const safeStatus=value=>({P:'Presença',M:'Meio período',F:'Ausência',S:'Sem registro'}[value]||(value?'Afastamento registrado':'Sem apontamento disponível'));
const clock=value=>/^\d{2}:\d{2}$/.test(String(value||''))?value:'';
const costEngine=()=>createLaborCostEngine({getPayrollHolidays,isWeekdayIso:prIsWeekdayIso,isEmployeeEmployedOnDate,getAttendance:getAtt,getHolidayPayRule});

export function buildClientAdministrationTeam({data,projectId,asOf,month:requestedMonth,canonicalEvents=[],issues=[]}){
 const month=clientTeamMonth(requestedMonth,asOf),[year,monthNumber]=month.split('-').map(Number);
 const days=getDays(year,monthNumber-1).filter(day=>day<=asOf),cutoff=days.at(-1);
 const work=data.obras?.find(item=>String(item.id)===projectId);
 if(!work)throw Object.assign(new Error('Obra indisponível.'),{status:404});
 const projection=readWorkAdministrationProjection(data,projectId,year,monthNumber-1,canonicalEvents,cutoff);
 const complete=!issues.some(issue=>!issue.obraId||issue.obraId===projectId)&&!projection.dre.ledger.issues.some(issue=>issue.severity==='error'&&(!issue.obraId||issue.obraId===projectId));
 const applicable=['admin_only','fixed_labor_admin'].includes(work.contractType);
 const rate=Number(work.adminPercentage),configured=Number.isFinite(rate)&&rate>0&&rate<=100;
 const issued=clientContractMeasurements(data,projectId,cutoff).filter(item=>item.competencia===month).reduce((sum,item)=>sum+toCents(item.valorAdminPct),0)/100;
 const engine=costEngine(),members=[];
 const titles=uniquePortalRecords((data.titulosFolha||[]).filter(title=>active(title)&&(title.competencia===month||!title.competencia&&String(title.periodKey||'').startsWith(`${month}-Q`))&&title.periodoFim<=cutoff&&title.rateiosPorObra?.some(row=>String(row.obraId)===projectId)));
 for(const employee of uniquePortalRecords(data.employees||[])){
  const isolated={...data,employees:[employee],archivedLaborCosts:{}};
  const costs=engine.calculateCurrentCostsByWork(isolated,days),cost=costs.find(row=>String(row.obraId)===projectId);
  const attendance=[];
  for(const date of days){
   if(!isEmployeeEmployedOnDate(employee,date))continue;
   const record=getAtt(data,employee.id,date);
   if(String(resolveEmployeeAttendanceObraId({data,employee,date,record}))!==projectId)continue;
   const mode=remunerationModeOnDate(employee,date);
   if(!record?.status&&(!prIsWeekdayIso(date)||mode==='mei'))continue;
   attendance.push({date,status:safeStatus(record?.status),start:clock(record?.entrada),breakStart:clock(record?.intervaloSaida),breakEnd:clock(record?.intervaloRetorno),end:clock(record?.saida),overtime:Number(record?.ot)||0});
  }
  const closed=titles.filter(title=>String(title.employeeId)===String(employee.id));
  if(!cost?.totalCost&&!attendance.some(day=>day.status!=='Sem apontamento disponível')&&!closed.length)continue;
  const gross=money((cost?.laborCost||0)-(cost?.chargesCost||0));
  const weights=costs.map(row=>({obraId:row.obraId,netObra:Math.max(0,row.laborCost-row.chargesCost)}));
  const draft=employee.laborProvisions?.[month]||newProvisionDraft(employee,month),reserve=calculateLaborProvision(draft);
  const reserveAllocation=amount=>{
   if(!reserve.included)return null;
   if(reserve.errors.length||!weights.some(row=>row.netObra>0))return null;
   return (allocateNetByWork(toCents(amount),weights).find(row=>String(row.obraId)===projectId)?.cents||0)/100;
  };
  const closedNet=closed.length?closed.reduce((sum,title)=>sum+title.rateiosPorObra.filter(row=>String(row.obraId)===projectId).reduce((total,row)=>total+toCents(row.valor),0),0)/100:null;
  const includedReserve=money(days.reduce((sum,date)=>{
   const daily=engine.calculateCurrentCost(isolated,projectId,[date]);
   return sum+Math.max(0,daily.laborCost-daily.chargesCost)*includedLaborProvisionFactor(remunerationModeOnDate(employee,date),data.config);
  },0));
  const reference=workforceReserveConfig(data.config).enabled?calculateWorkforceReserve(gross,data.config):null;
  const monthlyReserve=reference?(reference.errors.length?null:reference.monthly):reserveAllocation(reserve.monthly);
  const additionalReserve=monthlyReserve===null?null:money(Math.max(0,monthlyReserve-includedReserve));
  const additionalCharges=reference?(reference.errors.length?null:money(Math.max(0,reference.ordinaryCharges-Math.max(0,(cost?.chargesCost||0)-includedReserve)))):0;
  members.push({id:String(employee.id),name:String(employee.name||employee.nome||'Funcionário'),role:String(employee.role||employee.funcao||'Função não informada'),gross,benefits:money(cost?.benefitCost),charges:money(cost?.chargesCost),recognized:money(cost?.totalCost),closedNet,
   passThrough:additionalReserve===null||additionalCharges===null?null:money((cost?.totalCost||0)+additionalReserve+additionalCharges),includedReserve,additionalReserve,additionalCharges,
   attendance,provisions:reference?{included:true,source:'referencia',thirteenth:reference.thirteenth??null,vacation:reference.vacation??null,chargesOnReserve:reference.chargesOnReserve??null,notice:reference.notice??null,noticeFgts:reference.noticeFgts??null,noticeAccrual:reference.noticeAccrual??null,fine:reference.fine??null,rounding:reference.rounding??null,monthly:monthlyReserve}:{included:reserve.included,source:employee.laborProvisions?.[month]?'cadastrada':'estimativa',thirteenth:reserveAllocation(reserve.thirteenth),vacation:reserveAllocation((reserve.vacation||0)+(reserve.vacationThird||0)),fgts:reserveAllocation(reserve.fgtsProvision),fine:reserveAllocation(reserve.fine),other:reserveAllocation(Number(draft.extraReserve)||0),monthly:monthlyReserve}});
 }
 members.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const labor=money(['mao_obra','beneficios','rescisao'].reduce((sum,category)=>sum+Number(projection.dre.costByCategory?.[category]||0),0));
 const sum=key=>members.reduce((total,row)=>total+toCents(row[key]),0)/100;
 const unassigned=complete?money(labor-sum('recognized')):null;
 const pendingReserves=members.filter(row=>row.provisions.monthly===null).length+(unassigned>Math.max(0.02,members.length*0.01)?1:0);
 const additionalReserve=pendingReserves?null:sum('additionalReserve');
 const additionalCharges=members.some(row=>row.additionalCharges===null)?null:sum('additionalCharges');
 const base=complete&&(!projection.incluiMaoDeObra||additionalReserve!==null&&additionalCharges!==null)?money(projection.adminBase+(projection.incluiMaoDeObra?additionalReserve+additionalCharges:0)):null;
 const calculated=applicable&&configured&&base!==null?money(base*rate/100):null;
 return {domain:'administration_team',payload:{id:`administracao-${projectId}-${month}`,month,asOf:cutoff,partial:month===asOf.slice(0,7),available:complete,
  administration:{applicable,rate:configured?rate:null,registeredBase:complete?money(projection.adminBase):null,registeredCalculated:complete&&applicable&&configured?money(projection.valorAdmin):null,additionalReserve,additionalCharges,base,calculated,issued,toIssue:calculated===null?null:money(Math.max(0,calculated-issued)),aboveCalculated:calculated===null?null:money(Math.max(0,issued-calculated)),categories:{labor:projection.incluiMaoDeObra,materials:projection.incluiMateriais,thirdParties:projection.incluiTerceirizados,equipment:projection.incluiEquipamentos,fieldEngineering:projection.incluiEngenhariaCampo,other:work.contractType==='admin_only'}},
  workforce:{recognized:complete?labor:null,individualized:sum('recognized'),unassigned,pendingReserves,closedNet:titles.length?titles.reduce((sum,title)=>sum+title.rateiosPorObra.filter(row=>String(row.obraId)===projectId).reduce((total,row)=>total+toCents(row.valor),0),0)/100:null,includedReserve:sum('includedReserve'),additionalReserve,additionalCharges,passThrough:complete&&additionalReserve!==null&&additionalCharges!==null?money(labor+additionalReserve+additionalCharges):null,reserve:pendingReserves?null:members.reduce((sum,row)=>sum+toCents(row.provisions.monthly),0)/100},members}};
}
