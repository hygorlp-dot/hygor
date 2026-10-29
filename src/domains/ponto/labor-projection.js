import { createLaborCostEngine } from "../financeiro/labor-cost-engine.js";
import { remunerationModeOnDate } from "../rh/remuneration-mode.js";
import {
  getAtt, getHolidayPayRule, getPayrollHolidays, getPayrollPaymentCalendar, getQ,
  isEmployeeEmployedOnDate, prIsWeekdayIso,
} from "./attendance-engine.js";
import { isLeaveStatus, isValidAttendanceStatus, workedFactor } from "./attendance-status.js";
import { normalizeAttendanceRecord } from "./records.js";
import { resolveEmployeeAttendanceObraId, resolveHolidayObraId } from "./permissions.js";

export const LABOR_PROJECTION_POLICY=Object.freeze({minimumObservedDays:20,minimumCoverage:0.8});
export const LABOR_PROJECTION_METHODOLOGY_VERSION="2026-10-29.1";
export const LABOR_PROJECTION_ASSUMPTIONS=Object.freeze({
  calendar:"O calendário é o da Folha: segunda a sexta, com feriados tratados separadamente; jornada em horas não cria uma escala semanal.",
  history:"A janela contém os três meses de calendário anteriores à abertura da quinzena e não muda na virada do mês.",
  coverage:"Cobertura = dias P, M ou F divididos pelos dias previstos menos FE, AT e FG. Vazio, conflito e classificação pendente são dados ausentes.",
  probability:"F e M têm probabilidades próprias, ponderadas pelos dias observados; meio período não é falta injustificada.",
  reserve:"A reserva preserva parcelas apuradas e eventos confirmados; presença integral é aplicada somente às parcelas ordinárias ainda não apuradas. Não é teto de despesa.",
  pending:"Ponto pendente usa presença integral apenas como reserva provisória; essa parcela não está apurada.",
  unavailable:"Sem amostra suficiente, a taxa e a estimativa de presença ficam indisponíveis; o valor com presença integral continua como referência de reserva.",
  salary:"Salário CLT de competência e encargos permanecem no motor canônico. A frequência ajusta somente benefícios dependentes de presença, sem criar desconto em folha.",
  limited:"F histórico pode incluir férias, atestado ou folga na classificação antiga. A estimativa é provisória e não comprova falta injustificada.",
  holiday:"O pagamento do feriado é condicional à classificação dos dias úteis vizinhos; enquanto houver pendência, a referência considera ausência de F nesses dias.",
  holidayAllocation:"A obra do feriado segue o último P/M anterior. Se depender de trabalho futuro ou pendente, a alocação é condicional ao cenário de presença integral.",
  futureAttendance:"P ou M lançado em data futura não é presença já ocorrida; o dia ordinário permanece estimado.",
  futureAbsence:"Há F lançado em data futura. O cenário preserva o lançamento explícito, que deve ser conferido e não constitui desconto automático.",
  overtime:"Somente horas extras explicitamente registradas neste dia entram na simulação; extras de outros dias não são repetidas.",
  rounding:"Cada parcela diária de mão de obra e benefícios é arredondada em centavos; totais somam esses centavos. Encargos já integram mão de obra.",
});
export const LABOR_PROJECTION_ISSUE_MESSAGES=Object.freeze({
  HISTORY_SOURCE_INCOMPLETE:"Parte das fontes históricas está indisponível ou incompleta; a cobertura é parcial.",
  HISTORY_INSUFFICIENT:"A amostra individual e o grupo comparável não atingem os critérios mínimos; a taxa está indisponível.",
  HISTORY_GROUP_FALLBACK:"A estimativa usa dias ponderados de um grupo comparável da mesma modalidade, função, centro e jornada.",
  HISTORICAL_CLASSIFICATION_LIMITED:"Histórico com classificação limitada: F antigo não comprova falta injustificada; estimativa provisória.",
  EMPLOYMENT_START_MISSING:"A data de admissão está ausente ou inválida; não é possível presumir continuidade do vínculo.",
  EMPLOYMENT_END_MISSING:"Cadastro inativo sem término válido; os dias sem evidência de vínculo ficam indisponíveis.",
  EMPLOYMENT_HISTORY_INCOMPLETE:"A reativação não tem histórico suficiente para reconstruir todos os intervalos de vínculo.",
  OUTSIDE_EMPLOYMENT_RECORD:"Há ponto fora do intervalo de vínculo informado; esse registro requer conferência.",
  REMUNERATION_MISSING:"Remuneração ausente ou inválida: a parcela não pode ser precificada.",
  INVALID_BENEFITS:"Há valor de benefício inválido; a parcela não pode ser precificada integralmente.",
  CLT_DAILY_FALLBACK:"CLT sem salário mensal válido usa o custeio legado por diária do motor; o cadastro deve ser conferido.",
  UNSUPPORTED_REMUNERATION:"A modalidade informada não possui motor de custo integrado a esta projeção.",
  UNASSIGNED_ALLOCATION:"Parcela sem lotação definida; não foi distribuída arbitrariamente entre obras.",
  PENDING_ATTENDANCE:"O dia passado ou corrente ainda não possui classificação válida e conferida.",
  UNCONFIRMED_FUTURE_ATTENDANCE:"Presença futura lançada não foi tratada como custo já apurado.",
  FUTURE_ABSENCE_RECORDED:"Falta lançada em data futura: confira a programação antes de utilizá-la no fechamento.",
  HOLIDAY_CONDITIONAL:"O custo do feriado depende de classificação ainda desconhecida nos dias úteis vizinhos.",
  HOLIDAY_ALLOCATION_CONDITIONAL:"A obra responsável pelo feriado depende de trabalho ainda futuro ou pendente.",
  PLANNED_OVERTIME:"A simulação contém horas extras explicitamente previstas para este dia.",
  OFF_SCHEDULE_ATTENDANCE:"Registro fora dos dias úteis do calendário da Folha; não entrou na exposição ordinária.",
  THIRD_PARTY_NOT_INCLUDED:"Contratos de terceiros não foram projetados por fator semanal: faltam motor e calendário do ciclo nesta fonte de mão de obra.",
});

const isoDate=value=>{
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
};
const addDays=(value,amount)=>{
  const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+amount);
  return date.toISOString().slice(0,10);
};
const calendarMonth=(value,amount)=>{
  const [year,month,day]=value.split("-").map(Number);
  const first=new Date(Date.UTC(year,month-1+amount,1,12));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  first.setUTCDate(Math.min(day,last));return first.toISOString().slice(0,10);
};
const datesBetween=(start,end)=>{
  const dates=[];for(let date=start;date<=end;date=addDays(date,1))dates.push(date);return dates;
};

export function businessDateIso(now,timeZone="America/Bahia") {
  if(isoDate(now))return now;
  const date=now instanceof Date?now:new Date(now);
  if(now==null||!Number.isFinite(date.getTime()))throw new TypeError("A projeção requer uma referência temporal válida do servidor.");
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function resolveActiveLaborPeriod(asOf,data={}) {
  const date=businessDateIso(asOf);
  const day=Number(date.slice(8));
  const reference=day<=5?calendarMonth(date,-1):date;
  const year=Number(reference.slice(0,4)),monthIndex=Number(reference.slice(5,7))-1;
  const fortnight=day>=6&&day<=20?"1":"2";
  const days=[...getQ(year,monthIndex)[`q${fortnight}`]];
  const payment=getPayrollPaymentCalendar(year,monthIndex,fortnight,data);
  return {key:`${reference.slice(0,7)}-Q${fortnight}`,startDate:days[0],endDate:days.at(-1),days,
    year,monthIndex,fortnight,paymentDate:payment.paymentDate,basePaymentDate:payment.baseDate};
}

export function resolveLaborHistoryWindow(period) {
  if(!isoDate(period?.startDate))throw new TypeError("Quinzena inválida para a janela histórica.");
  const starts=[-3,-2,-1].map(offset=>calendarMonth(period.startDate,offset));
  return {startDate:starts[0],endDate:addDays(period.startDate,-1),intervals:starts.map((startDate,index)=>({
    key:`${startDate}/${addDays(starts[index+1]||period.startDate,-1)}`,
    startDate,endDate:addDays(starts[index+1]||period.startDate,-1),
  }))};
}

const COUNT_FIELDS=["expectedDays","observedDays","missingDays","excludedDays","absenceDays","halfDays","presentDays","holidayDays","nonWorkingDays"];
const counts=()=>Object.fromEntries(COUNT_FIELDS.map(key=>[key,0]));
const normalizeRole=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toLowerCase();
const number=value=>value!==null&&value!==""&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null;
const cents=value=>value==null||!Number.isFinite(Number(value))?null:Math.round((Number(value)+Number.EPSILON)*100);
const money=value=>{const result=cents(value);return result===null?null:result/100;};
const positive=value=>number(value)!==null&&Number(value)>0;
const cleanMoney=cost=>{
  if(!cost)return {laborCost:null,chargesCost:null,benefitCost:null,totalCost:null};
  const labor=cents(cost.laborCost),benefit=cents(cost.benefitCost),charges=cents(cost.chargesCost);
  if(labor===null||benefit===null||charges===null)return {laborCost:null,chargesCost:null,benefitCost:null,totalCost:null};
  return {laborCost:labor/100,chargesCost:charges/100,benefitCost:benefit/100,totalCost:(labor+benefit)/100};
};
const totalOf=(rows,key)=>rows.reduce((sum,row)=>sum+(cents(row[key])??0),0)/100;
const uniqueDays=rows=>new Set(rows.map(row=>`${row.employeeId}|${row.date}`)).size;
const totalsFor=(rows,asOf)=>{
  const byPartition=partition=>totalOf(rows.filter(row=>row.partition===partition),"totalCost");
  const actualCost=byPartition("actual"),confirmedFutureCost=byPartition("confirmedFuture"),estimatedCost=byPartition("estimated"),pendingCost=byPartition("pending");
  const unpriced=rows.filter(row=>row.totalCost===null),pending=rows.filter(row=>row.partition==="pending");
  return {employeeCount:new Set(rows.map(row=>row.employeeId)).size,actualCost,confirmedFutureCost,estimatedCost,pendingCost,
    projectedCost:money(actualCost+confirmedFutureCost+estimatedCost+pendingCost),
    estimatedAndPendingCost:money(estimatedCost+pendingCost),futureCost:money(confirmedFutureCost+estimatedCost+pendingCost),
    fullAttendanceReserve:totalOf(rows,"reserveCost"),futureDays:uniqueDays(rows.filter(row=>row.date>asOf)),
    pendingDays:uniqueDays(pending),unpricedDays:uniqueDays(unpriced),unpricedReserveDays:uniqueDays(rows.filter(row=>row.reserveCost===null)),
    laborCost:totalOf(rows,"laborCost"),chargesCost:totalOf(rows,"chargesCost"),benefitCost:totalOf(rows,"benefitCost"),
    partial:unpriced.length>0||rows.some(row=>row.reserveCost===null),
    provisional:pending.length>0||rows.some(row=>row.provisional)};
};

const rawStatus=record=>typeof record==="string"?record:record?.status;
const classification=(raw,source={})=>{
  const record=normalizeAttendanceRecord(raw);
  const status=record?.status;
  const incompleteClock=["P","M"].includes(status)&&record?.confirmed!==true
    && ((Boolean(record.entrada)!==Boolean(record.saida))||(Boolean(record.intervaloSaida)!==Boolean(record.intervaloRetorno)));
  const pending=record?.confirmed===false||record?.pending===true||record?.pendingSync===true
    ||["pending","pendente","aguardando","incomplete"].includes(record?.syncStatus||record?.reviewStatus)
    ||["conflict","missing"].includes(source?.kind)||incompleteClock;
  return {record,status:!pending&&isValidAttendanceStatus(status)?status:null};
};
const modeAt=(employee,date)=>{
  const declared=String(employee?.remunerationMode||"daily");
  if(!["daily","clt"].includes(declared)&&!(employee.remunerationHistory||[]).some(item=>item.date<=date))return declared;
  return remunerationModeOnDate(employee,date);
};
const groupFor=(data,employee,obraId)=>{
  if(employee.workArea==="administrativo")return {id:"administrative",kind:"administrative",obraId:"",name:"Administrativo"};
  if(obraId)return {id:`work:${obraId}`,kind:"work",obraId,name:(data.obras||[]).find(work=>String(work.id)===obraId)?.name||"Obra sem cadastro disponível"};
  return {id:"unassigned",kind:"unassigned",obraId:"",name:"Sem lotação definida"};
};
const allowedGroup=(group,access)=>{
  if(!access)return true;
  if(group.kind!=="work")return access.includeAdministrative!==false;
  return access.allowedWorkIds==null||access.allowedWorkIds.map(String).includes(group.obraId);
};
const matchesFilters=(row,filters,{employee=true,issues=true}={})=>{
  if(filters.area&&filters.area!=="all"&&({works:"work",administrative:"administrative",unassigned:"unassigned"}[filters.area]!==row.kind))return false;
  if(filters.obraId&&row.obraId!==String(filters.obraId))return false;
  if(employee&&filters.employeeId&&row.employeeId!==String(filters.employeeId))return false;
  if(filters.mode&&row.mode!==filters.mode)return false;
  if(filters.role&&normalizeRole(row.role)!==normalizeRole(filters.role))return false;
  if(issues&&filters.onlyIssues&&row.partition!=="pending"&&!row.issueCodes?.length)return false;
  return true;
};

const historySummary=(cells,window)=>{
  const summary={...window,...counts(),intervals:window.intervals.map(interval=>({...interval,...counts()})),limitedClassification:false};
  for(const cell of cells){
    for(const field of COUNT_FIELDS)summary[field]+=cell[field]||0;
    const interval=summary.intervals.find(item=>cell.date>=item.startDate&&cell.date<=item.endDate);
    if(interval)for(const field of COUNT_FIELDS)interval[field]+=cell[field]||0;
    summary.limitedClassification||=!!cell.limitedClassification;
  }
  const finish=target=>{target.eligibleDays=target.expectedDays-target.excludedDays;target.coverage=target.eligibleDays?target.observedDays/target.eligibleDays:null;};
  finish(summary);summary.intervals.forEach(finish);
  summary.representedIntervals=summary.intervals.filter(interval=>interval.observedDays>0).length;
  return summary;
};
const adequate=history=>history.observedDays>=LABOR_PROJECTION_POLICY.minimumObservedDays
  &&history.coverage!==null&&history.coverage+1e-12>=LABOR_PROJECTION_POLICY.minimumCoverage;
const rateFrom=(history,source,reason)=>({
  value:source==="unavailable"?null:history.absenceDays/history.observedDays,
  halfDayProbability:source==="unavailable"?null:history.halfDays/history.observedDays,
  presentProbability:source==="unavailable"?null:history.presentDays/history.observedDays,
  source,numerator:history.absenceDays,denominator:history.observedDays,coverage:history.coverage,
  representedIntervals:history.representedIntervals,limitedClassification:history.limitedClassification,reason,
});
const comparativeKey=(employee,mode,group,role)=>{
  const normalized=normalizeRole(role);if(!normalized||!["daily","clt"].includes(mode))return "";
  const hours=positive(employee.workdayHours)?Number(employee.workdayHours):8;
  return [mode,normalized,group.id,hours,"payroll-mon-fri"].join("|");
};

export function buildLaborProjection(data={},options={}) {
  const timeZone=options.timeZone||"America/Bahia";
  const asOf=businessDateIso(options.asOf??options.generatedAt,timeZone);
  const period=resolveActiveLaborPeriod(asOf,data),window=resolveLaborHistoryWindow(period);
  const filters={area:"all",obraId:"",employeeId:"",mode:"",role:"",onlyIssues:false,...options.filters};
  const sources=options.attendanceSources||{},snapshots=options.employeeSnapshotsByDate||{},sourceIssues=options.historyIssues||[];
  const employees=[...new Map((data.employees||[]).filter(employee=>employee?.id).map(employee=>[String(employee.id),employee])).values()];
  const events=new Map();
  for(const event of data.changeLog||[]){const id=String(event.empId||event.employeeId||"");if(!events.has(id))events.set(id,[]);events.get(id).push(event);}
  const blocked=(id,date)=>sourceIssues.some(issue=>issue.affectsHistory&&(!issue.employeeId||String(issue.employeeId)===id)
    &&date>=(issue.startDate||issue.date||"9999")&&date<=(issue.endDate||issue.date||"0000"));
  const sourceAt=(id,date)=>blocked(id,date)?{kind:"missing"}:(sources[id]?.[date]||{kind:"live"});
  const employeeCache=new Map();
  const employeeAt=(current,date)=>{
    const key=`${current.id}|${date}`;if(employeeCache.has(key))return employeeCache.get(key);
    const snapshot=snapshots[date]?.[String(current.id)];
    const employee=snapshot?{...current,...snapshot,id:current.id}: {...current};
    if(snapshot&&!Object.hasOwn(snapshot,"workArea"))employee.workArea=snapshot.obra?"campo":"";
    if(!snapshot){
      for(const event of [...(events.get(String(current.id))||[])].filter(event=>event.type==="promotion"&&event.date>date).sort((a,b)=>b.date.localeCompare(a.date)))if(event.from)employee.role=event.from;
    }
    employeeCache.set(key,employee);return employee;
  };
  const employed=(current,employee,date,status)=>{
    if(isoDate(employee.startDate)&&date<employee.startDate)return {value:false};
    if(isoDate(employee.endDate)&&date>employee.endDate)return {value:false};
    const lifecycle=(events.get(String(current.id))||[]).filter(event=>["dismissal","employee_archived","reactivation"].includes(event.type)&&isoDate(event.date)).sort((a,b)=>a.date.localeCompare(b.date));
    const reactivation=lifecycle.find(event=>event.type==="reactivation");
    let last=null;
    for(const event of lifecycle)if(event.type==="reactivation"?event.date<=date:event.date<date)last=event;
    if(last&&last.type!=="reactivation")return {value:false};
    if(reactivation&&date<reactivation.date&&!lifecycle.some(event=>event.type!=="reactivation"&&event.date<=reactivation.date)&&!snapshots[date]?.[String(current.id)]&&!status)return {value:null,code:"EMPLOYMENT_HISTORY_INCOMPLETE"};
    if(!isoDate(employee.startDate))return status?{value:true,code:"EMPLOYMENT_START_MISSING"}:{value:null,code:"EMPLOYMENT_START_MISSING"};
    if(employee.active===false&&!isoDate(employee.endDate)&&!snapshots[date]?.[String(current.id)]&&last?.type!=="reactivation")return status?{value:true,code:"EMPLOYMENT_END_MISSING"}:{value:null,code:"EMPLOYMENT_END_MISSING"};
    return {value:true};
  };
  const holidaysByYear=new Map();
  const holidaysFor=date=>{
    const year=Number(date.slice(0,4));if(!holidaysByYear.has(year))holidaysByYear.set(year,getPayrollHolidays(data,year));
    return holidaysByYear.get(year);
  };
  const isHoliday=date=>prIsWeekdayIso(date)&&holidaysFor(date).includes(date);
  const recordsByEmployee=new Map();
  for(const employee of employees){
    const id=String(employee.id),records={};
    for(const [date,raw] of Object.entries(data.attendance?.[id]||{})){
      const classified=classification(raw,sourceAt(id,date));records[date]=classified.status?classified.record:null;
    }
    recordsByEmployee.set(id,records);
  }
  const cleanData={...data,archivedLaborCosts:{},attendance:Object.fromEntries(recordsByEmployee)};
  const historyCells=[],byEmployee=new Map(),pools=new Map(),historyProblems=new Map();
  for(const current of employees){
    const id=String(current.id),cells=[];
    for(const date of datesBetween(window.startDate,window.endDate)){
      const employee=employeeAt(current,date),source=sourceAt(id,date),classified=classification(data.attendance?.[id]?.[date],source);
      const relation=employed(current,employee,date,classified.status);if(relation.value===false)continue;
      const holiday=isHoliday(date),obraId=holiday?resolveHolidayObraId({data:cleanData,employee,holidayIso:date}):resolveEmployeeAttendanceObraId({data:cleanData,employee,date,record:classified.record});
      const group=groupFor(data,employee,obraId);if(!allowedGroup(group,options.access))continue;
      if(relation.code)historyProblems.set(`${id}|${relation.code}`,{code:relation.code,employeeId:id});
      const mode=modeAt(employee,date),role=classified.record?.role||employee.role||"";
      const cell={employeeId:id,date,groupId:group.id,...group,mode,role,...counts(),limitedClassification:false};
      if(!prIsWeekdayIso(date))cell.nonWorkingDays=1;
      else if(holiday)cell.holidayDays=1;
      else {
        cell.expectedDays=1;
        if(relation.value!==true||!classified.status)cell.missingDays=1;
        else if(isLeaveStatus(classified.status))cell.excludedDays=1;
        else {
          cell.observedDays=1;
          if(classified.status==="F")cell.absenceDays=1;
          if(classified.status==="M")cell.halfDays=1;
          if(classified.status==="P")cell.presentDays=1;
          cell.limitedClassification=classified.status==="F"&&(source.limitedClassification===true||(source.limitedClassification!==false&&date<"2026-10-29"));
        }
      }
      cells.push(cell);historyCells.push(cell);
      const key=comparativeKey(employee,mode,group,role);
      if(key){if(!pools.has(key))pools.set(key,[]);pools.get(key).push(cell);}
    }
    byEmployee.set(id,historySummary(cells,window));
  }
  const poolSummaries=new Map([...pools].map(([key,cells])=>[key,historySummary(cells,window)]));
  const rateFor=(id,employee,mode,group,role)=>{
    const own=byEmployee.get(id)||historySummary([],window);
    if(adequate(own))return rateFrom(own,"individual","Amostra individual de três meses, ponderada pelos dias observados.");
    const pool=poolSummaries.get(comparativeKey(employee,mode,group,role));
    if(pool&&adequate(pool))return rateFrom(pool,"group",LABOR_PROJECTION_ISSUE_MESSAGES.HISTORY_GROUP_FALLBACK);
    return rateFrom(own,"unavailable",LABOR_PROJECTION_ISSUE_MESSAGES.HISTORY_INSUFFICIENT);
  };
  // Uma chamada por pessoa/data/cenário evita o cache por primeiro ano do motor
  // e preserva o denominador mensal do CLT na quinzena que atravessa dois meses.
  const engine=createLaborCostEngine({getPayrollHolidays:(source,year)=>[...new Set([year-1,year,year+1].flatMap(value=>getPayrollHolidays(source,value)))],
    isWeekdayIso:prIsWeekdayIso,isEmployeeEmployedOnDate,getAttendance:getAtt,getHolidayPayRule});
  const allRows=[],allIssues=[],allAssumptions=new Set([LABOR_PROJECTION_ASSUMPTIONS.calendar,LABOR_PROJECTION_ASSUMPTIONS.history,LABOR_PROJECTION_ASSUMPTIONS.coverage,LABOR_PROJECTION_ASSUMPTIONS.probability,LABOR_PROJECTION_ASSUMPTIONS.reserve,LABOR_PROJECTION_ASSUMPTIONS.rounding]);
  const addIssue=(code,detail={},severity="warning")=>{
    const message=LABOR_PROJECTION_ISSUE_MESSAGES[code]||LABOR_PROJECTION_ISSUE_MESSAGES.HISTORY_SOURCE_INCOMPLETE;
    allIssues.push({code,severity,message,...detail});return code;
  };
  for(const issue of historyProblems.values())addIssue(issue.code,{employeeId:issue.employeeId});
  for(const issue of sourceIssues)addIssue(String(issue.code||"HISTORY_SOURCE_INCOMPLETE"),{...(issue.employeeId?{employeeId:String(issue.employeeId)}:{}),...(isoDate(issue.date)?{date:issue.date}:{})},issue.severity||"warning");
  const thirdParties=data.terceirizados||data.terceiros||[];
  if(Array.isArray(thirdParties)&&thirdParties.some(item=>item&&item.active!==false))addIssue("THIRD_PARTY_NOT_INCLUDED");
  for(const current of employees){
    const id=String(current.id),actualRecords=recordsByEmployee.get(id)||{},reserveRecords={...actualRecords};
    for(const date of datesBetween(period.startDate,addDays(period.endDate,7))){
      if(!prIsWeekdayIso(date)||isHoliday(date))continue;
      const employee=employeeAt(current,date),classified=classification(data.attendance?.[id]?.[date],sourceAt(id,date));
      if(employed(current,employee,date,classified.status).value!==true)continue;
      if((date>asOf&&!isLeaveStatus(classified.status)&&classified.status!=="F")||!classified.status){
        reserveRecords[date]={status:"P",ot:0,obraId:resolveEmployeeAttendanceObraId({data:cleanData,employee,date,record:classified.record})};
      }
    }
    const makeData=(employee,records)=>({...data,employees:[employee],attendance:{[id]:records},archivedLaborCosts:{}});
    const scenario=(employee,date,records,record)=>{
      const map=record===undefined?records:{...records,[date]:record};
      const source=makeData(employee,map);
      const obraId=isHoliday(date)?resolveHolidayObraId({data:source,employee,holidayIso:date}):resolveEmployeeAttendanceObraId({data:source,employee,date});
      return {obraId,cost:engine.calculateWorkLaborCost(source,obraId,[date])};
    };
    for(const date of period.days){
      const employee=employeeAt(current,date),source=sourceAt(id,date),classified=classification(data.attendance?.[id]?.[date],source);
      const status=classified.status,relation=employed(current,employee,date,status),future=date>asOf,holiday=isHoliday(date);
      const addExcludedRecordIssue=code=>{
        const obraId=holiday?resolveHolidayObraId({data:cleanData,employee,holidayIso:date}):resolveEmployeeAttendanceObraId({data:cleanData,employee,date,record:classified.record});
        const group=groupFor(data,employee,obraId);
        const context={...group,employeeId:id,role:classified.record?.role||employee.role||"",mode:modeAt(employee,date),partition:"pending",issueCodes:[code]};
        if(allowedGroup(group,options.access)&&matchesFilters(context,filters))addIssue(code,{employeeId:id,date,obraId:group.obraId,groupId:group.id});
      };
      if(relation.value===false){
        if(status)addExcludedRecordIssue("OUTSIDE_EMPLOYMENT_RECORD");
        continue;
      }
      if(!prIsWeekdayIso(date)){
        if(status)addExcludedRecordIssue("OFF_SCHEDULE_ATTENDANCE");
        continue;
      }
      const mode=modeAt(employee,date),monthly=mode==="clt"&&positive(employee.monthlySalary);
      const baseRecord=classified.record||{},scenarioRecord=code=>{
        const record={status:code,ot:Math.max(0,Number(baseRecord.ot)||0),obraId:resolveEmployeeAttendanceObraId({data:cleanData,employee,date,record:baseRecord})};
        for(const key of ["archivedDailyRate","archivedVtDaily","archivedVrDaily","archivedWorkdayHours","archivedOvertimeAdditionalPercent"])if(Object.hasOwn(baseRecord,key))record[key]=baseRecord[key];
        return record;
      };
      let partition=future?(status==="F"||isLeaveStatus(status)?"confirmedFuture":"estimated"):(status?"actual":"pending");
      const codes=[],assumptions=[];
      if(relation.code)codes.push(relation.code);
      if(!["daily","clt"].includes(mode))codes.push("UNSUPPORTED_REMUNERATION");
      if(mode==="clt"&&!monthly)codes.push("CLT_DAILY_FALLBACK");
      if(future&&["P","M"].includes(status)){codes.push("UNCONFIRMED_FUTURE_ATTENDANCE");assumptions.push(LABOR_PROJECTION_ASSUMPTIONS.futureAttendance);}
      if(future&&status==="F"){codes.push("FUTURE_ABSENCE_RECORDED");assumptions.push(LABOR_PROJECTION_ASSUMPTIONS.futureAbsence);}
      if(!future&&!status&&!holiday){codes.push("PENDING_ATTENDANCE");assumptions.push(LABOR_PROJECTION_ASSUMPTIONS.pending);}
      if(partition!=="actual"&&Number(baseRecord.ot)>0){codes.push("PLANNED_OVERTIME");assumptions.push(LABOR_PROJECTION_ASSUMPTIONS.overtime);}
      let holidayConditional=false,allocationConditional=false;
      if(holiday){
        const context=makeData(employee,actualRecords),holidays=[...new Set([Number(date.slice(0,4))-1,Number(date.slice(0,4)),Number(date.slice(0,4))+1].flatMap(year=>getPayrollHolidays(data,year)))];
        const rule=getHolidayPayRule(context,employee,date,holidays);
        const neighbors=[rule.before,rule.after];
        holidayConditional=!monthly&&!rule.losesHoliday&&neighbors.some(day=>{
          const neighbor=classification(data.attendance?.[id]?.[day],sourceAt(id,day));
          return !neighbor.status||(day>asOf&&["P","M"].includes(neighbor.status));
        });
        for(let cursor=addDays(date,-1),index=0;index<31;cursor=addDays(cursor,-1),index++){
          if(["P","M"].includes(rawStatus(actualRecords[cursor]))&&cursor<=asOf)break;
          if(prIsWeekdayIso(cursor)&&!isHoliday(cursor)&&(!actualRecords[cursor]||cursor>asOf)){allocationConditional=true;break;}
        }
        if(holidayConditional){codes.push("HOLIDAY_CONDITIONAL");assumptions.push(LABOR_PROJECTION_ASSUMPTIONS.holiday);}
        if(allocationConditional){codes.push("HOLIDAY_ALLOCATION_CONDITIONAL");assumptions.push(LABOR_PROJECTION_ASSUMPTIONS.holidayAllocation);}
        partition=future?(holidayConditional?"estimated":"confirmedFuture"):(holidayConditional?"pending":"actual");
      }
      const useReserve=partition==="estimated"||partition==="pending"||future;
      const records=useReserve?reserveRecords:actualRecords;
      const full=scenario(employee,date,records,holiday?undefined:scenarioRecord("P"));
      const known=scenario(employee,date,partition==="actual"?actualRecords:reserveRecords,holiday?undefined:baseRecord);
      const group=groupFor(data,employee,full.obraId),role=baseRecord.role||employee.role||"";
      const rate=rateFor(id,employee,mode,group,role);
      if(group.kind==="unassigned")codes.push("UNASSIGNED_ALLOCATION");
      const zeroStatus=status==="F"||status==="FG"&&(data.config?.attendanceLeavePayFactors?.FG??0)===0;
      const dailyValue=baseRecord.archivedDailyRate??employee.dailyRate;
      const remunerated=monthly||positive(dailyValue)||zeroStatus&&partition!=="estimated"&&partition!=="pending";
      if(!remunerated)codes.push("REMUNERATION_MISSING");
      const invalidBenefits=[baseRecord.archivedVtDaily??employee.vtDaily,baseRecord.archivedVrDaily??employee.vrDaily].some(value=>value!=null&&value!==""&&(number(value)===null||Number(value)<0));
      if(invalidBenefits)codes.push("INVALID_BENEFITS");
      const validPrice=relation.value===true&&["daily","clt"].includes(mode)&&remunerated&&!invalidBenefits;
      const regularEstimate=partition==="estimated"&&!holiday;
      if(regularEstimate&&rate.source==="unavailable"){codes.push("HISTORY_INSUFFICIENT");assumptions.push(LABOR_PROJECTION_ASSUMPTIONS.unavailable);}
      if(regularEstimate&&rate.source==="group")codes.push("HISTORY_GROUP_FALLBACK");
      if(regularEstimate&&rate.limitedClassification){codes.push("HISTORICAL_CLASSIFICATION_LIMITED");assumptions.push(LABOR_PROJECTION_ASSUMPTIONS.limited);}
      let expected;
      if(partition==="actual"||partition==="confirmedFuture")expected=known.cost;
      else if(partition==="pending"||holiday)expected=full.cost;
      else if(rate.value!==null){
        const half=scenario(employee,date,reserveRecords,scenarioRecord("M")).cost;
        const absent=scenario(employee,date,reserveRecords,scenarioRecord("F")).cost;
        expected=Object.fromEntries(["laborCost","chargesCost","benefitCost"].map(key=>[key,rate.presentProbability*full.cost[key]+rate.halfDayProbability*half[key]+rate.value*absent[key]]));
      }else expected=null;
      const actualWeight=workedFactor(status),expectedWeight=rate.value===null?null:rate.presentProbability+rate.halfDayProbability*.5;
      const weight=holiday?0:partition==="actual"||partition==="confirmedFuture"?actualWeight:partition==="pending"?1:expectedWeight;
      const reserveWeight=holiday?0:partition==="actual"||partition==="confirmedFuture"?actualWeight:1;
      const emit=(component,part,cost,reserve,extra={})=>{
        const finalCost=cleanMoney(cost),reserveCost=cleanMoney(reserve).totalCost;
        const issueCodes=[...new Set(codes)];
        for(const code of issueCodes)addIssue(code,{employeeId:id,date,obraId:group.obraId,groupId:group.id},code==="PLANNED_OVERTIME"||code==="HISTORY_GROUP_FALLBACK"?"info":"warning");
        assumptions.forEach(text=>allAssumptions.add(text));
        allRows.push({date,employeeId:id,obraId:group.obraId,groupId:group.id,kind:group.kind,groupName:group.name,role,workArea:employee.workArea||"",mode,
          component,status:holiday?"HOLIDAY":status,source:source.kind||"live",partition:part,...finalCost,reserveCost,
          workedDaysWeight:weight,reserveWorkedDaysWeight:reserveWeight,rate:{...rate},
          issueCodes,issues:issueCodes.map(code=>LABOR_PROJECTION_ISSUE_MESSAGES[code]),assumptions:[...new Set(assumptions)],
          provisional:part==="pending"||holidayConditional||allocationConditional||(regularEstimate&&rate.limitedClassification),...extra});
      };
      if(monthly&&relation.value===true){
        assumptions.push(LABOR_PROJECTION_ASSUMPTIONS.salary);allAssumptions.add(LABOR_PROJECTION_ASSUMPTIONS.salary);
        const salary={laborCost:full.cost.laborCost,chargesCost:full.cost.chargesCost,benefitCost:0};
        emit("salary",future?"confirmedFuture":"actual",salary,salary,{workedDaysWeight:0,reserveWorkedDaysWeight:0});
        if(!holiday){
          const attendance=validPrice?(expected?{laborCost:0,chargesCost:0,benefitCost:expected.benefitCost}:full.cost.benefitCost===0?{laborCost:0,chargesCost:0,benefitCost:0}:null):null;
          emit("attendance",partition,attendance,invalidBenefits?null:{laborCost:0,chargesCost:0,benefitCost:partition==="actual"||partition==="confirmedFuture"?known.cost.benefitCost:full.cost.benefitCost});
        }
      }else emit("daily",partition,validPrice?expected:null,validPrice?(partition==="actual"||partition==="confirmedFuture"?known.cost:full.cost):null);
    }
  }
  const authorizedRows=allRows.filter(row=>allowedGroup(row,options.access));
  const authorizedIds=new Set(authorizedRows.map(row=>row.employeeId));
  const filterOptions={
    works:[...new Map(authorizedRows.filter(row=>row.kind==="work").map(row=>[row.obraId,{id:row.obraId,name:row.groupName}])).values()].sort((a,b)=>a.name.localeCompare(b.name)),
    roles:[...new Set(authorizedRows.map(row=>row.role).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),
    modes:[...new Set(authorizedRows.map(row=>row.mode))].sort(),
    employees:employees.filter(employee=>authorizedIds.has(String(employee.id))).map(employee=>({id:String(employee.id),name:String(employee.name||"Pessoa sem nome cadastrado")})).sort((a,b)=>a.name.localeCompare(b.name)),
  };
  const visibleRows=authorizedRows.filter(row=>matchesFilters(row,filters));
  const visibleIds=new Set(visibleRows.map(row=>row.employeeId));
  const people=employees.filter(employee=>visibleIds.has(String(employee.id))).map(employee=>{
    const id=String(employee.id),days=visibleRows.filter(row=>row.employeeId===id),first=days.find(row=>row.date>=asOf)||days[0];
    return {id,name:String(employee.name||"Pessoa sem nome cadastrado"),role:first.role,workArea:first.workArea,mode:first.mode,
      ...totalsFor(days,asOf),rate:{...first.rate},history:byEmployee.get(id)||historySummary([],window),days};
  });
  // A população histórica inclui quem trabalhou na janela e saiu antes do
  // ciclo: esses dias também podem fundamentar a taxa comparável publicada.
  const selectedHistory=historyCells.filter(cell=>matchesFilters(cell,filters,{issues:false})
    &&(!filters.onlyIssues||visibleIds.has(cell.employeeId)));
  const groups=[...new Set(visibleRows.map(row=>row.groupId))].map(id=>{
    const days=visibleRows.filter(row=>row.groupId===id),first=days[0],history=historySummary(selectedHistory.filter(cell=>cell.groupId===id),window);
    return {id,kind:first.kind,obraId:first.obraId,name:first.groupName,...totalsFor(days,asOf),history,
      rate:{value:history.observedDays?history.absenceDays/history.observedDays:null,source:"aggregate",numerator:history.absenceDays,denominator:history.observedDays,
        coverage:history.coverage,limitedClassification:history.limitedClassification,reason:"Histórico descritivo ponderado do recorte; cada pessoa usa sua própria origem de taxa."}};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const issueKeys=new Set();
  const issues=allIssues.filter(issue=>{
    if(issue.employeeId&&!visibleIds.has(issue.employeeId))return false;
    const excludedRecord=["OFF_SCHEDULE_ATTENDANCE","OUTSIDE_EMPLOYMENT_RECORD"].includes(issue.code);
    if(issue.groupId&&!excludedRecord&&!visibleRows.some(row=>row.groupId===issue.groupId&&(!issue.employeeId||row.employeeId===issue.employeeId)&&(!issue.date||row.date===issue.date)))return false;
    const key=[issue.code,issue.employeeId,issue.date,issue.groupId].join("|");if(issueKeys.has(key))return false;issueKeys.add(key);return true;
  });
  const totals=totalsFor(visibleRows,asOf);
  totals.partial||=sourceIssues.some(issue=>issue.affectsHistory!==false)||issues.some(issue=>issue.code==="THIRD_PARTY_NOT_INCLUDED");
  totals.provisional||=sourceIssues.some(issue=>issue.affectsHistory===false);
  const result={methodologyVersion:LABOR_PROJECTION_METHODOLOGY_VERSION,policy:{...LABOR_PROJECTION_POLICY},generatedAt:options.generatedAt||null,asOf,timeZone,period,
    history:historySummary(selectedHistory,window),totals,groups,people,issues,assumptions:[...allAssumptions],filters,options:filterOptions};
  // Evidência interna para a fronteira de autorização manter o seletor estável
  // após um filtro de tela. A whitelist nunca devolve esta estrutura ao cliente.
  result._authorizedPeople=[...authorizedIds].map(id=>({id,groups:[...new Map(authorizedRows
    .filter(row=>row.employeeId===id).map(row=>[row.groupId,{kind:row.kind,obraId:row.obraId}])).values()]}));
  if(options.includeCashBasis)result._cashBasis={period:{...period,days:[...period.days]},people:[...visibleIds].map(id=>({id,days:allRows.filter(row=>row.employeeId===id).map(row=>({
    date:row.date,obraId:row.obraId,groupId:row.groupId,mode:row.mode,status:row.status,component:row.component,partition:row.partition,
    laborCost:row.laborCost,chargesCost:row.chargesCost,benefitCost:row.benefitCost,totalCost:row.totalCost,reserveCost:row.reserveCost,
    workedDaysWeight:row.workedDaysWeight,reserveWorkedDaysWeight:row.reserveWorkedDaysWeight,
  }))}))};
  return result;
}
