import { createHash } from "node:crypto";
import { createLaborCostEngine } from "../src/domains/financeiro/labor-cost-engine.js";
import { getAtt,getPayrollHolidays,getHolidayPayRule,isEmployeeEmployedOnDate,prIsWeekdayIso,getPayrollPaymentCalendar } from "../src/domains/ponto/attendance-engine.js";
import { isValidAttendanceStatus,isLeaveStatus } from "../src/domains/ponto/attendance-status.js";
import { resolveEmployeeAttendanceObraId,resolveHolidayObraId } from "../src/domains/ponto/permissions.js";
import { remunerationModeOnDate } from "../src/domains/rh/remuneration-mode.js";
import { laborArea } from "../src/domains/rh/labor-area.js";
import { PROJECTION_POLICY,businessDate,projectionPeriod,dateRange } from "../src/domains/ponto/labor-projection.js";
import { composeLaborProjectionSource } from "./labor-projection-source.js";
import { podeAcessarAba } from "../src/domains/administracao/abas-acesso.js";
import { activePayrollTitlesForPeriod,allocateNetByWork } from "../src/domains/ponto/payroll-closing.js";
import { active } from "../src/domains/financeiro/ledger.js";
import { totalLiquidadoFolha,saldoTituloFolha } from "../src/domains/conciliacao/payroll.js";
import { advanceDeductionForPeriod } from "../src/domains/rh/advance-commands.js";
import { calculatePayrollSettlement,calculateUnionDue } from "../src/domains/ponto/union-dues.js";
import { splitPayrollResponsibility } from "../src/domains/ponto/payroll-responsibility.js";

const cents=value=>Math.round((Number(value||0)+Number.EPSILON)*100);
const normalized=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
const zero=()=>({laborCost:0,benefitCost:0,chargesCost:0,totalCost:0});
const changeIndexes=new WeakMap(),emptyChanges=[];
const changesOf=(data,id)=>{
  const events=data.changeLog||emptyChanges;
  if(!changeIndexes.has(events)){
    const index=new Map();for(const event of events){const key=String(event.empId||"");if(!index.has(key))index.set(key,[]);index.get(key).push(event);}changeIndexes.set(events,index);
  }
  return changeIndexes.get(events).get(String(id))||emptyChanges;
};
const holidaysFor=(data,year)=>data.projectionCalendar?.get(year)||getPayrollHolidays(data,year);
export function laborProjectionAccess(user,filters={}) {
  if (!user) return {status:401,error:"Sessão inválida."};
  if (!["admin","rh","financeiro"].includes(user.role)||!(podeAcessarAba(user,"folha")||podeAcessarAba(user,"relat"))) return {status:403,error:"Sem acesso ÃƒÆ’Ã‚Â  projeção de mão de obra."};
  const detail=["admin","rh"].includes(user.role);
  if (!detail&&filters.employeeId) return {status:403,error:"Este perfil consulta somente valores agregados."};
  if (user.obraId&&filters.obraId&&filters.obraId!=="all"&&String(filters.obraId)!==String(user.obraId)) return {status:403,error:"Obra fora do escopo autorizado."};
  return {detail,workId:String(user.obraId||"")};
}

function employeeOnDate(employee,date,data) {
  const stored=data.projectionSnapshots?.[`${employee.id}|${date}`];
  if(stored)return stored;
  let result=employee;
  const future=changesOf(data,employee.id).filter(event=>event.date>date).sort((a,b)=>b.date.localeCompare(a.date));
  for(const event of future) {
    if(event.type==="promotion")result={...result,role:event.from};
    if(event.type==="salary_change"&&Number.isFinite(Number(event.from)))result={...result,dailyRate:Number(event.from)};
  }
  return result;
}
function employed(employee,date,data={}) {
  if(!isEmployeeEmployedOnDate(employee,date))return false;
  const events=changesOf(data,employee.id).filter(event=>event.date<=date&&["dismissal","employee_archived","reactivation"].includes(event.type)).sort((a,b)=>a.date.localeCompare(b.date));
  const last=events.at(-1);
  if(last&&last.type!=="reactivation"&&last.date<date)return false;
  return true;
}
const engine=source=>createLaborCostEngine({getPayrollHolidays,isWeekdayIso:prIsWeekdayIso,isEmployeeEmployedOnDate:(employee,date)=>employed(employee,date,source),getAttendance:getAtt,getHolidayPayRule,getEmployeeForDate:employeeOnDate});

function historicalStats(data,employee,period,workId) {
  const intervals=period.intervals.map(interval=>({...interval,expected:0,observed:0,absences:0,half:0,leaves:0,pending:0}));
  for(const interval of intervals)for(const date of dateRange(interval.start,interval.end)){
    const emp=employeeOnDate(employee,date,data),record=getAtt(data,employee.id,date);
    if(laborArea(emp)!==laborArea(employee)||normalized(emp.role)!==normalized(employee.role)||remunerationModeOnDate(emp,date)!==remunerationModeOnDate(employee,period.start)||Number(emp.workdayHours||8)!==Number(employee.workdayHours||8))continue;
    if(!prIsWeekdayIso(date)||holidaysFor(data,Number(date.slice(0,4))).includes(date)||!employed(emp,date,data))continue;
    if(workId&&resolveEmployeeAttendanceObraId({data,employee:emp,date,record})!==workId)continue;
    interval.expected++;
    if(isLeaveStatus(record?.status)){interval.leaves++;continue;}
    if(["P","M","F"].includes(record?.status)){interval.observed++;if(record.status==="F")interval.absences++;if(record.status==="M")interval.half++;}
    else interval.pending++;
  }
  return summarizeHistory(intervals);
}
export function summarizeHistory(intervals) {
  const totals=intervals.reduce((sum,interval)=>{for(const key of ["expected","observed","absences","half","leaves","pending"])sum[key]+=interval[key];return sum;},{expected:0,observed:0,absences:0,half:0,leaves:0,pending:0});
  const exposure=totals.expected-totals.leaves;
  const coverage=exposure?totals.observed/exposure:0;
  return {...totals,coverage,intervals,intervalsWithData:intervals.filter(interval=>interval.observed>0).length,rate:totals.observed?totals.absences/totals.observed:null,sufficient:totals.observed>=PROJECTION_POLICY.minimumObserved&&coverage>=PROJECTION_POLICY.minimumCoverage};
}
function combinedStats(stats) {
  return summarizeHistory(stats[0].intervals.map((interval,index)=>{
    const result={start:interval.start,end:interval.end,expected:0,observed:0,absences:0,half:0,leaves:0,pending:0};
    for(const item of stats)for(const key of ["expected","observed","absences","half","leaves","pending"])result[key]+=item.intervals[index][key];
    return result;
  }));
}

export function buildLaborProjection({data,user,filters={},instant,archiveSource={archives:[],missing:[],versions:[]},sourceVersion=""}) {
  const access=laborProjectionAccess(user,filters);if(access.error)return {error:access.error,status:access.status};
  const cutoff=businessDate(instant),period=projectionPeriod(cutoff);
  const composed=composeLaborProjectionSource(data,archiveSource.archives,period.historyStart,period.end);
  const source=composed.data;
  source.projectionCalendar=new Map([...new Set([period.historyStart,period.historyEnd,period.start,period.end].map(date=>Number(date.slice(0,4))))].map(year=>[year,getPayrollHolidays(source,year)]));
  const incomplete=archiveSource.missing.length>0||composed.conflicts.length>0;
  const historical=new Map(source.employees.map(employee=>[String(employee.id),historicalStats(source,employee,period,access.workId)]));
  const groups=new Map();
  const cohortKey=employee=>`${laborArea(employee)}|${remunerationModeOnDate(employee,period.start)}|${normalized(employee.role)}|${Number(employee.workdayHours||8)}`;
  for(const employee of source.employees){const key=cohortKey(employee);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(historical.get(String(employee.id)));}
  const rates=new Map(source.employees.map(employee=>{
    const personal=historical.get(String(employee.id)),group=combinedStats(groups.get(cohortKey(employee)));
    const chosen=!incomplete&&personal.sufficient?{...personal,origin:"individual"}:!incomplete&&group.sufficient&&normalized(employee.role)?{...group,origin:"grupo comparável"}:{...personal,rate:null,origin:"indisponível"};
    return [String(employee.id),{...chosen,personal}];
  }));
  // Três fotografias em memória; os cenários não escrevem apontamentos.
  const ordinary=employee=>Object.fromEntries(period.dates.map(date=>{
    const original=getAtt(source,employee.id,date),confirmed=isValidAttendanceStatus(original?.status)&&(date<=cutoff||isLeaveStatus(original.status)||original.confirmed===true);
    return [date,confirmed?original:{status:"P",ot:0}];
  }));
  const present={...source,attendance:{...source.attendance}};
  const absent={...source,attendance:{...source.attendance}};
  for(const employee of source.employees){present.attendance[employee.id]={...source.attendance[employee.id],...ordinary(employee)};absent.attendance[employee.id]={...source.attendance[employee.id],...Object.fromEntries(Object.entries(ordinary(employee)).map(([date,record])=>[date,isValidAttendanceStatus(getAtt(source,employee.id,date)?.status)&&(date<=cutoff||isLeaveStatus(getAtt(source,employee.id,date).status)||getAtt(source,employee.id,date).confirmed===true)?record:{status:"F",ot:0}]))};}
  const calculator=engine(source);
  const index=dataset=>new Map([...new Set(period.dates.map(date=>date.slice(0,4)))].flatMap(year=>calculator.calculateDailyCosts(dataset,period.dates.filter(date=>date.startsWith(year)))).map(item=>[`${item.employeeId}|${item.date}`,item]));
  const known=index(source),full=index(present),noShow=index(absent);
  const people=[],memory=[],pending=[];
  let archiveOnlyNotProjected=0;
  const workFilter=access.workId||(filters.obraId!=="all"&&String(filters.obraId||""));
  for(const employee of source.employees){
    const id=String(employee.id),rate=rates.get(id);
    if(employee.projectionArchiveOnly&&!period.dates.some(date=>date<=cutoff&&isValidAttendanceStatus(getAtt(source,id,date)?.status))){archiveOnlyNotProjected++;continue;}
    if(filters.employeeId&&id!==String(filters.employeeId))continue;
    if(filters.role&&normalized(employee.role)!==normalized(filters.role))continue;
    const person={id,name:employee.name||"Funcionário",role:employee.role||"Sem função",area:laborArea(employee),history:rate,days:[],issues:[],mode:remunerationModeOnDate(employee,cutoff)};
    for(const date of period.dates){
      const emp=employeeOnDate(employee,date,source),record=getAtt(source,id,date),mode=remunerationModeOnDate(emp,date);
      if(!prIsWeekdayIso(date)||!employed(emp,date,source))continue;
      // Uma pessoa inativa sem data de desligamento não tem futuro presumido.
      if(filters.mode&&filters.mode!=="all"&&mode!==filters.mode)continue;
      const holiday=holidaysFor(source,Number(date.slice(0,4))).includes(date);
      const holidayRule=holiday?getHolidayPayRule(source,emp,date,holidaysFor(source,Number(date.slice(0,4)))):null;
      const conditional=holidayRule&&[holidayRule.before,holidayRule.after].some(day=>!isValidAttendanceStatus(getAtt(source,id,day)?.status));
      const obraId=holiday?resolveHolidayObraId({data:source,employee:emp,holidayIso:date}):resolveEmployeeAttendanceObraId({data:source,employee:emp,date,record});
      if(date>=cutoff&&(employee.projectionArchiveOnly||(employee.active===false&&!employee.endDate)||!emp.startDate)){
        person.issues.push("Vínculo atual incompleto: parcela futura excluída");pending.push({employeeId:id,date,obraId,reason:"Vínculo atual não confirmado; fora da projeção futura"});
        const unknown={employeeId:id,date,obraId,area:laborArea(emp),mode,component:"vínculo incompleto",partition:date<=cutoff?"pendente":"estimado",status:null,expectedCents:null,reserveCents:null,laborCents:null,benefitsCents:null,chargesCents:null,rate:null,rateOrigin:"indisponível",source:"live"};person.days.push(unknown);memory.push(unknown);continue;
      }
      const monthly=mode==="clt"&&Number(emp.monthlySalary)>0;
      const hasPay=monthly||Number(record?.archivedDailyRate??emp.dailyRate)>0;
      const confirmed=isValidAttendanceStatus(record?.status)&&(date<=cutoff||isLeaveStatus(record.status)||record.confirmed===true);
      const actual=known.get(`${id}|${date}`)||zero(),p=full.get(`${id}|${date}`)||zero(),f=noShow.get(`${id}|${date}`)||zero();
      const partition=!monthly&&holiday&&conditional&&date<=cutoff?"pendente":confirmed?(date<=cutoff?"apurado":"programado"):date<=cutoff?"pendente":"estimado";
      const provisional=!confirmed&&!holiday;
      const reliable=rate.rate!==null&&hasPay&&mode===remunerationModeOnDate(employee,period.start)&&normalized(emp.role)===normalized(employee.role);
      const expected=provisional?(reliable?Object.fromEntries(["laborCost","benefitCost","chargesCost","totalCost"].map(field=>[field,(1-rate.rate)*p[field]+rate.rate*f[field]])):null):actual;
      const cost=hasPay?(expected?cents(expected.totalCost):null):null;
      const entry={employeeId:id,date,obraId,area:laborArea(emp),mode,partition,status:confirmed?record.status:null,holiday,conditional:!!conditional,expectedCents:cost,reserveCents:hasPay?cents((provisional?p:actual).totalCost):null,
        laborCents:expected?cents(expected.laborCost):null,benefitsCents:expected?cents(expected.benefitCost):null,chargesCents:expected?cents(expected.chargesCost):null,rate:provisional&&reliable?rate.rate:null,rateOrigin:provisional?(reliable?rate.origin:"indisponível"):"fato ou programação",source:composed.origins[`${id}|${date}`]||"live"};
      if(monthly){
        const salary={...entry,component:"salário e encargos",conditional:false,partition:date<=cutoff?"apurado":"programado",expectedCents:cents(actual.laborCost),reserveCents:cents(actual.laborCost),laborCents:cents(actual.laborCost),benefitsCents:0,chargesCents:cents(actual.chargesCost),rate:null,rateOrigin:"salário contratual canônico",rawSalary:actual.laborCost,rawCharges:actual.chargesCost};
        person.days.push(salary);memory.push(salary);
        entry.component="benefícios";entry.conditional=false;entry.expectedCents=provisional?(p.benefitCost>0?(reliable?cents((1-rate.rate)*p.benefitCost+rate.rate*f.benefitCost):null):0):cents(actual.benefitCost);
        entry.laborCents=0;entry.chargesCents=0;entry.benefitsCents=entry.expectedCents;
        entry.unknownBenefits=entry.expectedCents===null;
      }
      if(mode==="clt"&&!monthly)person.issues.push("CLT sem salário mensal: motor usa diária legada");
      if(entry.laborCents!==null&&entry.benefitsCents!==null)entry.expectedCents=entry.laborCents+entry.benefitsCents;
      entry.reserveCents=hasPay?cents((provisional?p:actual).laborCost)+cents((provisional?p:actual).benefitCost):null;
      if(monthly)entry.reserveCents=cents((provisional?p:actual).benefitCost);
      if(!hasPay)person.issues.push("Remuneração ausente");
      if(partition==="pendente"||!hasPay||entry.conditional||entry.unknownBenefits)pending.push({employeeId:id,date,obraId,reason:!hasPay?"Remuneração ausente":entry.unknownBenefits?"Benefícios CLT sem base histórica":entry.conditional?"Feriado condicionado a apontamentos adjacentes":"Dia sem classificação válida"});
      person.days.push(entry);memory.push(entry);
    }
    if(person.days.length||person.issues.length){person.issues=[...new Set(person.issues)];people.push(person);}
  }
  // Rateio de centavos preserva salário mensal canônico e os denominadores
  // de cada competência, sem introduzir centavos extras ao detalhar dias.
  const salaryGroups=new Map();
  for(const entry of memory.filter(day=>day.component==="salário e encargos")){
    const key=`${entry.employeeId}|${entry.date.slice(0,7)}`;
    if(!salaryGroups.has(key))salaryGroups.set(key,[]);salaryGroups.get(key).push(entry);
  }
  for(const entries of salaryGroups.values())for(const [raw,field] of [["rawSalary","laborCents"],["rawCharges","chargesCents"]]){
    const target=cents(entries.reduce((sum,entry)=>sum+entry[raw],0));
    let remainder=target;
    for(const entry of entries){entry[field]=Math.floor(entry[raw]*100);remainder-=entry[field];}
    const ranked=[...entries].sort((a,b)=>(b[raw]*100-Math.floor(b[raw]*100))-(a[raw]*100-Math.floor(a[raw]*100)));
    for(const entry of ranked){if(remainder>0){entry[field]++;remainder--;}}
  }
  for(const entries of salaryGroups.values())for(const entry of entries){entry.expectedCents=entry.laborCents;entry.reserveCents=entry.laborCents;delete entry.rawSalary;delete entry.rawCharges;}
  const summarize=days=>{
    const result={knownCents:0,scheduledCents:0,estimatedCents:0,pendingCents:0,reserveCents:0,laborCents:0,benefitsCents:0,chargesCents:0,unknown:0,pendingDays:0,remainingDays:0};
    const fields={apurado:"knownCents",programado:"scheduledCents",estimado:"estimatedCents",pendente:"pendingCents"};
    for(const day of days){result[fields[day.partition]]+=day.expectedCents||0;result.reserveCents+=day.reserveCents||0;result.laborCents+=day.laborCents||0;result.benefitsCents+=day.benefitsCents||0;result.chargesCents+=day.chargesCents||0;if(day.expectedCents===null||day.unknownBenefits)result.unknown++;if(day.partition==="pendente")result.pendingDays++;if(day.date>cutoff)result.remainingDays++;}
    result.remainingDays=new Set(days.filter(day=>day.date>cutoff).map(day=>`${day.employeeId}|${day.date}`)).size;
    result.pendingDays=new Set(days.filter(day=>day.partition==="pendente").map(day=>`${day.employeeId}|${day.date}`)).size;
    result.partialCents=result.knownCents+result.scheduledCents+result.estimatedCents+result.pendingCents;
    result.totalCents=result.unknown?null:result.partialCents;
    result.scenarioDifferenceCents=result.totalCents===null?null:result.reserveCents-result.totalCents;
    return result;
  };
  for(const person of people)person.totals=summarize(person.days);
  const titles=activePayrollTitlesForPeriod(source,period.key);
  for(const person of people){
    const employee=source.employees.find(item=>String(item.id)===person.id);
    const closed=titles.filter(title=>String(title.employeeId)===person.id);
    if(closed.length){
      const cashRows=closed.map(title=>{
        if(!workFilter)return {netCents:cents(title.liquido),paidCents:cents(totalLiquidadoFolha(title)),balanceCents:cents(saldoTituloFolha(title))};
        const weights=(title.rateiosPorObra||[]).map(item=>({...item,netObra:item.valor}));
        if(!weights.length)return null;
        const selected=allocation=>allocation.filter(item=>String(item.obraId)===workFilter).reduce((sum,item)=>sum+item.cents,0);
        const netAllocation=allocateNetByWork(cents(title.liquido),weights);
        const netCents=selected(netAllocation);
        const paidCents=selected(allocateNetByWork(cents(totalLiquidadoFolha(title)),netAllocation.map(item=>({...item,netObra:item.cents}))));
        return {netCents,paidCents,balanceCents:Math.max(0,netCents-paidCents)};
      });
      person.cash=cashRows.some(item=>!item)?{source:"rateio fechado indisponível",netCents:null,paidCents:null,balanceCents:null,retentionCents:null}:{source:"título fechado",netCents:cashRows.reduce((sum,item)=>sum+item.netCents,0),paidCents:cashRows.reduce((sum,item)=>sum+item.paidCents,0),balanceCents:cashRows.reduce((sum,item)=>sum+item.balanceCents,0),retentionCents:null};
    }else if(!person.days.length||person.issues.some(issue=>issue.includes("Vínculo atual incompleto"))||person.days.some(day=>day.mode==="clt")||person.totals.totalCents===null){person.cash={source:"indisponível",netCents:null,balanceCents:null,paidCents:0,retentionCents:null};}
    else{
      const advances=(source.advances||[]).filter(item=>String(item.empId)===person.id).reduce((sum,item)=>sum+advanceDeductionForPeriod(item,period.start,period.end),0);
      const union=calculateUnionDue({employee,config:source.config?.unionDues,payrollCycle:period.cycle,periodEnd:period.end,periodKey:period.key,hasPayrollMovement:person.totals.partialCents>0});
      const settled=calculatePayrollSettlement({gross:(person.totals.laborCents-person.totals.chargesCents)/100,benefits:person.totals.benefitsCents/100,advances,unionDue:union.amount});
      person.cash={source:"estimativa provisória",netCents:cents(settled.netPayable),paidCents:0,balanceCents:cents(settled.netPayable),retentionCents:cents(settled.appliedUnionDue),retentionDue:null,advancesCents:cents(advances)};
    }
    if((workFilter||(filters.area&&filters.area!=="all"))&&person.cash.source==="estimativa provisória"){
      const byWork=new Map();for(const day of person.days){const key=`${day.area}|${day.obraId}`;const item=byWork.get(key)||{obraId:day.obraId,area:day.area,netObra:0};item.netObra+=Math.max(0,(day.laborCents||0)-(day.chargesCents||0)+(day.benefitsCents||0));byWork.set(key,item);}
      const weights=[...byWork.values()];
      const selected=value=>allocateNetByWork(value,weights).filter(item=>(!workFilter||item.obraId===workFilter)&&(!filters.area||filters.area==="all"||item.area===filters.area)).reduce((sum,item)=>sum+item.cents,0);
      person.cash={...person.cash,netCents:selected(person.cash.netCents),balanceCents:selected(person.cash.balanceCents),retentionCents:selected(person.cash.retentionCents),advancesCents:selected(person.cash.advancesCents)};
    }
    const settlementTransactions=new Set(closed.flatMap(title=>(title.liquidacoes||[]).filter(active).map(item=>String(item.transacaoId))));
    const relevant=item=>{const date=item.date||item.data||"";return !date||(date>=period.start&&date<=period.end);};
    const ambiguous=(source.pagamentosFolha||[]).some(item=>active(item)&&relevant(item)&&String(item.employeeId||item.empId||item.funcionarioId||"")===person.id&&!settlementTransactions.has(String(item.transacaoId||"")))
      ||(source.transacoes||[]).some(item=>active(item)&&relevant(item)&&item.vinculo?.tipo==="funcionario"&&String(item.vinculo.id)===person.id&&!settlementTransactions.has(String(item.id)));
    if(ambiguous){person.cash.balanceCents=null;person.cash.paidCents=null;person.cash.source="pagamento sem título/período inequívoco";person.issues.push("Conferir alocação dos pagamentos de folha antes de estimar o saldo");}
  }
  const selectedDay=day=>(!workFilter||day.obraId===workFilter)&&(!filters.area||filters.area==="all"||day.area===filters.area);
  if(workFilter||(filters.area&&filters.area!=="all")){
    for(const person of people){
      if(person.cash.source==="título fechado"&&filters.area&&filters.area!=="all"&&person.days.some(day=>day.area!==filters.area)){person.cash.netCents=null;person.cash.balanceCents=null;person.cash.source="Título sem divisão histórica por área";}
      person.days=person.days.filter(selectedDay);
    }
    for(let index=memory.length-1;index>=0;index--)if(!selectedDay(memory[index]))memory.splice(index,1);
    for(let index=pending.length-1;index>=0;index--)if(!memory.some(day=>day.employeeId===pending[index].employeeId&&day.date===pending[index].date&&day.obraId===pending[index].obraId))pending.splice(index,1);
    for(let index=people.length-1;index>=0;index--)if(!people[index].days.length)people.splice(index,1);
  }
  if(filters.pendingOnly==="true") {
    const ids=new Set(pending.map(item=>item.employeeId));
    for(let index=people.length-1;index>=0;index--)if(!ids.has(people[index].id))people.splice(index,1);
    for(let index=memory.length-1;index>=0;index--)if(!ids.has(memory[index].employeeId))memory.splice(index,1);
  }
  for(const person of people)person.totals=summarize(person.days);
  const byWork=new Map();
  for(const day of memory){const key=day.area==="central"?"central":day.obraId||"unassigned";if(!byWork.has(key))byWork.set(key,[]);byWork.get(key).push(day);}
  const works=[...byWork].map(([id,days])=>({id,label:id==="central"?"Administração Central":id==="unassigned"?"Sem lotação definida":source.obras?.find(work=>String(work.id)===id)?.name||id,employeeCount:new Set(days.map(day=>day.employeeId)).size,rateMin:days.some(day=>day.rate!==null)?Math.min(...days.filter(day=>day.rate!==null).map(day=>day.rate)):null,rateMax:days.some(day=>day.rate!==null)?Math.max(...days.filter(day=>day.rate!==null).map(day=>day.rate)):null,rateOrigins:[...new Set(days.filter(day=>["estimado","pendente"].includes(day.partition)).map(day=>day.rateOrigin))],...summarize(days),coverage:combinedStats([...new Set(days.map(day=>day.employeeId))].map(id=>historical.get(id)))}));
  const cash={netCents:0,balanceCents:0,paidCents:0,unavailable:0,retentionCents:0,retentionDue:null};
  for(const person of people){if(person.cash.netCents===null||person.cash.balanceCents===null)cash.unavailable++;else{cash.netCents+=person.cash.netCents;cash.balanceCents+=person.cash.balanceCents;cash.paidCents+=person.cash.paidCents;}cash.retentionCents+=person.cash.retentionCents||0;}
  if(cash.unavailable){cash.partialNetCents=cash.netCents;cash.partialBalanceCents=cash.balanceCents;cash.netCents=null;cash.balanceCents=null;}
  cash.retentionUnavailable=people.filter(person=>person.cash.retentionCents===null).length;
  if(cash.retentionUnavailable){cash.partialRetentionCents=cash.retentionCents;cash.retentionCents=null;}
  const allocations=memory.map(day=>({obraId:day.obraId,obraName:source.obras?.find(work=>String(work.id)===day.obraId)?.name||"Sem lotação",netObra:(day.expectedCents||0)/100}));
  const responsibility=splitPayrollResponsibility({allocations,works:source.obras||[]});
  const payment=getPayrollPaymentCalendar(Number(period.start.slice(0,4)),Number(period.start.slice(5,7))-1,period.cycle,source);
  const version=createHash("sha256").update(JSON.stringify({sourceVersion,archives:archiveSource.versions,cutoff,instant,filters,access,method:PROJECTION_POLICY.version})).digest("hex").slice(0,24);
  const totals=summarize(memory);
  const excluded=pending.filter(item=>item.reason.includes("Vínculo atual não confirmado"));
  if(excluded.length)totals.totalCents=null;
  return {ok:true,version,methodology:PROJECTION_POLICY,cutoff,updatedAt:new Date(instant).toISOString(),timeZone:PROJECTION_POLICY.timeZone,period,payment,filters:{...filters,obraId:workFilter||"all"},canSeePeople:access.detail,
    totals:{...totals,employeeCount:people.length},cash,works,responsibility:{costAdministrationCents:cents(responsibility.totals.administrationWorks),costBuilderCents:cents(responsibility.totals.builder)},
    coverage:{partial:incomplete,readError:archiveSource.error||null,missingArchives:archiveSource.missing,conflicts:composed.conflicts.length,excluded:excluded.length,archiveOnlyNotProjected,intervals:period.intervals},
    thirdParties:{includedCount:0,excludedCount:(source.terceirizados||[]).filter(item=>active(item)&&item.active!==false&&(!workFilter||String(item.obraId)===workFilter)&&(!item.startDate||item.startDate<=period.end)&&(!item.endDate||item.endDate>=period.start)).length,reason:"Contratos por medição, semana ou diária não possuem apropriação diária canônica suficiente para a quinzena. Valores semanais não são convertidos por 4,3 e pagamentos não são tratados como custo de competência."},
    warnings:["Projeção provisória; faltas legadas podem incluir afastamentos antigos classificados como F.","Reserva integral é cenário, não teto. Encargos já incluem provisões conforme configuração; não somar novamente.","Retenções sem vencimento conhecido não compõem um saldo de repasse confirmado.","Terceirizados/MEI não são presumidos a partir do contrato da obra; somente empregados com modalidade cadastrada entram neste relatório."],
    ...(access.detail?{people,memory,pending}: {pendingSummary:pending.length})};
}
