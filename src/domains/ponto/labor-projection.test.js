import { describe, expect, it } from "vitest";
import { businessDateIso, buildLaborProjection, resolveActiveLaborPeriod, resolveLaborHistoryWindow } from "./labor-projection.js";
import { getAtt, getHolidayPayRule, getPayrollHolidays, isEmployeeEmployedOnDate, prIsWeekdayIso } from "./attendance-engine.js";
import { createLaborCostEngine } from "../financeiro/labor-cost-engine.js";

const baseEmployee=overrides=>({id:"e1",name:"Pessoa",role:"Pedreiro",workArea:"campo",obra:"o1",startDate:"2025-01-01",active:true,dailyRate:150,vtDaily:0,vrDaily:0,...overrides});
const fixture=employee=>({employees:[employee||baseEmployee()],obras:[{id:"o1",name:"Obra 1"},{id:"o2",name:"Obra 2"}],attendance:{},config:{laborCharges:{diaristaPercent:0}},changeLog:[]});
const datesBetween=(start,end)=>{
  const out=[];
  for(let date=new Date(`${start}T12:00:00Z`);date.toISOString().slice(0,10)<=end;date.setUTCDate(date.getUTCDate()+1))out.push(date.toISOString().slice(0,10));
  return out;
};
const historyFor=(data,asOf,absences=6,count=60,employeeId="e1")=>{
  const window=resolveLaborHistoryWindow(resolveActiveLaborPeriod(asOf,data));
  const dates=datesBetween(window.startDate,window.endDate).filter(date=>prIsWeekdayIso(date)&&!getPayrollHolidays(data,Number(date.slice(0,4))).includes(date)).slice(0,count);
  data.attendance[employeeId]=Object.fromEntries(dates.map((date,index)=>[date,{status:index<absences?"F":"P",obraId:"o1"}]));
  return dates;
};
const fillHistory=(data,asOf,employeeId="e1",statusAt=()=>"P")=>{
  const employee=data.employees.find(person=>person.id===employeeId);
  const window=resolveLaborHistoryWindow(resolveActiveLaborPeriod(asOf,data));
  const dates=datesBetween(window.startDate,window.endDate).filter(date=>prIsWeekdayIso(date)
    &&!getPayrollHolidays(data,Number(date.slice(0,4))).includes(date)
    &&isEmployeeEmployedOnDate(employee,date));
  data.attendance[employeeId]??={};
  dates.forEach((date,index)=>{const status=statusAt(date,index);if(status)data.attendance[employeeId][date]=typeof status==="object"?status:{status,obraId:employee.obra||""};});
  return dates;
};
const markThroughCutoff=(data,asOf,status="P",employeeId="e1")=>{
  const period=resolveActiveLaborPeriod(asOf,data);
  data.attendance[employeeId]??={};
  for(const date of period.days.filter(date=>date<=asOf&&prIsWeekdayIso(date)))data.attendance[employeeId][date]={status};
};
const zeroCltCharges={diaristaPercent:0,inssPatronalPercent:0,ratPercent:0,fap:1,terceirosPercent:0,fgtsPercent:0,multaFgtsPercent:0,provisionar13Ferias:false};
const canonicalEngine=()=>createLaborCostEngine({getPayrollHolidays,isWeekdayIso:prIsWeekdayIso,isEmployeeEmployedOnDate,getAttendance:getAtt,getHolidayPayRule});
const deepFreeze=value=>{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(deepFreeze);}return value;};
const sumCents=(rows,key)=>rows.reduce((sum,row)=>sum+Math.round((row[key]||0)*100),0);

describe("projeção da quinzena ativa",()=>{
  it("mantém ciclo e janela histórica na virada do mês",()=>{
    const october=resolveActiveLaborPeriod("2026-10-29");
    expect(october).toMatchObject({key:"2026-10-Q2",startDate:"2026-10-21",endDate:"2026-11-05"});
    expect(resolveActiveLaborPeriod("2026-11-01")).toEqual(october);
    expect(resolveLaborHistoryWindow(october)).toMatchObject({startDate:"2026-07-21",endDate:"2026-10-20"});
    expect(businessDateIso("2026-11-01T01:00:00Z","America/Bahia")).toBe("2026-10-31");
  });

  it("preserva 900 apurados e estima quatro diárias de 150 pela taxa de 10%",()=>{
    const data=fixture();
    historyFor(data,"2026-02-13");
    for(const date of ["2026-02-06","2026-02-09","2026-02-10","2026-02-11","2026-02-12","2026-02-13"])data.attendance.e1[date]={status:"P",obraId:"o1"};
    data.attendance.e1["2026-02-20"]={status:"FG",obraId:"o1"};
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.people[0].rate.value).toBe(.1);
    expect(report.totals).toMatchObject({actualCost:900,confirmedFutureCost:0,estimatedCost:540,pendingCost:0,projectedCost:1440,fullAttendanceReserve:1500});
  });

  it("sem amostra deixa a estimativa indisponível e mostra a reserva sem inventar taxa zero",()=>{
    const data=fixture(baseEmployee({startDate:"2026-10-29"}));
    const report=buildLaborProjection(data,{asOf:"2026-10-29"});
    expect(report.people[0].rate).toMatchObject({value:null,source:"unavailable"});
    expect(report.people[0].days.find(day=>day.date==="2026-10-30")).toMatchObject({totalCost:null,reserveCost:150});
    expect(report.totals.partial).toBe(true);
  });

  it("mantém opções autorizadas antes dos filtros de tela",()=>{
    const data=fixture();
    data.employees.push(baseEmployee({id:"e2",name:"Outra pessoa",obra:"o2",role:"Servente"}));
    const report=buildLaborProjection(data,{asOf:"2026-10-29",filters:{obraId:"o1"}});
    expect(report.options).toEqual({works:[{id:"o1",name:"Obra 1"},{id:"o2",name:"Obra 2"}],roles:["Pedreiro","Servente"],modes:["daily"],employees:[{id:"e2",name:"Outra pessoa"},{id:"e1",name:"Pessoa"}]});
    const restricted=buildLaborProjection(data,{asOf:"2026-10-29",access:{allowedWorkIds:["o1"],includeAdministrative:false}});
    expect(restricted.options.works).toEqual([{id:"o1",name:"Obra 1"}]);
    expect(restricted.options.employees).toEqual([{id:"e1",name:"Pessoa"}]);
  });

  it("agrupa administrativo explícito em centro próprio mesmo com obra legada",()=>{
    const data=fixture(baseEmployee({workArea:"administrativo"}));
    const report=buildLaborProjection(data,{asOf:"2026-10-29"});
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]).toMatchObject({id:"administrative",kind:"administrative",obraId:""});
    expect(report.people[0].days.find(day=>day.date==="2026-10-29")).toMatchObject({reserveCost:150,groupId:"administrative",obraId:""});
  });

  it("reserva calculada de ponto pendente é provisória sem tornar subtotal parcial",()=>{
    const data=fixture();
    historyFor(data,"2026-10-29",0);
    const report=buildLaborProjection(data,{asOf:"2026-10-29"});
    expect(report.totals.pendingDays).toBeGreaterThan(0);
    expect(report.totals).toMatchObject({partial:false,provisional:true,unpricedDays:0});
  });
});

describe("calendário empresarial e histórico",()=>{
  it.each([
    ["2026-01-01","2025-12-Q2","2025-12-21","2026-01-05"],
    ["2026-01-05","2025-12-Q2","2025-12-21","2026-01-05"],
    ["2026-01-06","2026-01-Q1","2026-01-06","2026-01-20"],
    ["2026-01-20","2026-01-Q1","2026-01-06","2026-01-20"],
    ["2026-01-21","2026-01-Q2","2026-01-21","2026-02-05"],
    ["2026-01-31","2026-01-Q2","2026-01-21","2026-02-05"],
    ["2028-02-29","2028-02-Q2","2028-02-21","2028-03-05"],
  ])("resolve limites do ciclo em %s",(asOf,key,startDate,endDate)=>{
    expect(resolveActiveLaborPeriod(asOf)).toMatchObject({key,startDate,endDate});
  });

  it("usa meses de calendário e mantém três intervalos contíguos",()=>{
    const window=resolveLaborHistoryWindow(resolveActiveLaborPeriod("2028-03-01"));
    expect(window).toMatchObject({startDate:"2027-11-21",endDate:"2028-02-20"});
    expect(window.intervals.map(({startDate,endDate})=>[startDate,endDate])).toEqual([
      ["2027-11-21","2027-12-20"],["2027-12-21","2028-01-20"],["2028-01-21","2028-02-20"],
    ]);
    expect(datesBetween(window.startDate,window.endDate)).toHaveLength(92);
  });

  it("usa data empresarial fornecida e rejeita referência ausente",()=>{
    expect(businessDateIso(new Date("2026-11-06T01:30:00Z"),"America/Bahia")).toBe("2026-11-05");
    expect(businessDateIso("2026-11-06T01:30:00Z","UTC")).toBe("2026-11-06");
    expect(()=>buildLaborProjection(fixture())).toThrow(/referência temporal/);
    expect(()=>businessDateIso("inválida")).toThrow(/referência temporal/);
  });

  it("classifica P/M/F, afastamentos, lacunas e batidas incompletas sem inventar faltas",()=>{
    const data=fixture(baseEmployee({startDate:"2026-01-06"}));
    const statuses=["P","M","F","FE","AT","FG",null,"X",{status:"P",pendingSync:true},{status:"P",entrada:"08:00"},{status:"P",confirmed:false}];
    fillHistory(data,"2026-02-13","e1",(_date,index)=>statuses[index]||null);
    data.attendance.e1["2026-01-10"]={status:"F"}; // sábado
    data.config.paymentHolidays=["2026-01-30"];
    data.attendance.e1["2026-01-30"]={status:"F"};
    data.dailyCheckDate="2026-02-05";
    const history=buildLaborProjection(data,{asOf:"2026-02-13"}).people[0].history;
    expect(history).toMatchObject({observedDays:3,presentDays:1,halfDays:1,absenceDays:1,excludedDays:3,holidayDays:1,limitedClassification:true});
    expect(history.missingDays).toBe(history.expectedDays-history.excludedDays-3);
    expect(history.coverage).toBe(3/(history.expectedDays-3));
    expect(history.intervals.reduce((sum,item)=>sum+item.observedDays,0)).toBe(3);
  });

  it("pondera grupos pelos dias, não pela média simples de percentuais individuais",()=>{
    const data=fixture();
    data.employees.push(baseEmployee({id:"e2"}),baseEmployee({id:"e3"}));
    historyFor(data,"2026-02-13",2,10,"e1");
    historyFor(data,"2026-02-13",1,20,"e2");
    historyFor(data,"2026-02-13",3,30,"e3");
    // Ponto até o corte: sem ele, diaristas parados há 30 dias saem da projeção.
    for(const id of ["e1","e2","e3"])markThroughCutoff(data,"2026-02-13","P",id);
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.history).toMatchObject({absenceDays:6,observedDays:60});
    expect(report.groups[0].rate).toMatchObject({source:"aggregate",numerator:6,denominator:60,value:.1});
    expect(report.groups[0].rate.value).not.toBeCloseTo((.2+.05+.1)/3,8);
  });

  it("não inclui a quinzena ativa nem muda a taxa apenas na virada do mês",()=>{
    const data=fixture();
    fillHistory(data,"2026-10-29","e1",(_date,index)=>index<5?"F":"P");
    markThroughCutoff(data,"2026-10-29","F");
    const before=buildLaborProjection(data,{asOf:"2026-10-29"});
    data.attendance.e1["2026-10-30"]={status:"F"};
    const after=buildLaborProjection(data,{asOf:"2026-11-01"});
    expect(after.people[0].rate).toEqual(before.people[0].rate);
    expect(after.people[0].history).toEqual(before.people[0].history);
  });

  it("uma fonte histórica indisponível reduz cobertura e não transforma seu vazio em F",()=>{
    const data=fixture();
    fillHistory(data,"2026-02-13");
    const report=buildLaborProjection(data,{asOf:"2026-02-13",historyIssues:[{code:"LABOR_ARCHIVE_MISSING",affectsHistory:true,startDate:"2025-11-06",endDate:"2026-01-31"}]});
    expect(report.people[0].history.missingDays).toBeGreaterThan(20);
    expect(report.people[0].history.absenceDays).toBe(0);
    expect(report.people[0].rate.source).toBe("unavailable");
    expect(report.totals.partial).toBe(true);
    expect(report.issues.some(issue=>issue.code==="LABOR_ARCHIVE_MISSING")).toBe(true);
  });
});

describe("origem da taxa e vínculo por data",()=>{
  it("usa grupo comparável e mantém desligados na amostra histórica",()=>{
    const data=fixture(baseEmployee({startDate:"2026-02-06"}));
    data.employees.push(baseEmployee({id:"old",name:"Pessoa desligada",active:false,endDate:"2026-02-05"}));
    const dates=fillHistory(data,"2026-02-13","old",(_date,index)=>index<6?"F":"P");
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.people.map(person=>person.id)).toEqual(["e1"]);
    expect(report.people[0].rate).toMatchObject({source:"group",numerator:6,denominator:dates.length,value:6/dates.length});
    expect(report.groups[0].history.observedDays).toBe(dates.length);
    expect(report.people[0].history.observedDays).toBe(0);
  });

  it.each([
    {obra:"o2"},{role:"Servente"},{workdayHours:6},{workArea:"administrativo"},{remunerationMode:"clt",monthlySalary:2000},
  ])("não empresta taxa de grupo incompatível %j",overrides=>{
    const data=fixture(baseEmployee({startDate:"2026-02-06"}));
    data.employees.push(baseEmployee({id:"donor",...overrides}));
    fillHistory(data,"2026-02-13","donor");
    const person=buildLaborProjection(data,{asOf:"2026-02-13",filters:{employeeId:"e1"}}).people[0];
    expect(person.rate).toMatchObject({source:"unavailable",value:null});
  });

  it("prioriza histórico individual mesmo havendo grupo diferente e filtro de pessoa",()=>{
    const data=fixture();
    data.employees.push(baseEmployee({id:"donor"}));
    historyFor(data,"2026-02-13",6,60);
    fillHistory(data,"2026-02-13","donor",()=>"F");
    const report=buildLaborProjection(data,{asOf:"2026-02-13",filters:{employeeId:"e1"}});
    expect(report.people[0].rate).toMatchObject({source:"individual",value:.1,denominator:60});
  });

  it("exige simultaneamente vinte observações e cobertura de oitenta por cento",()=>{
    const data=fixture();
    historyFor(data,"2026-02-13",0,20);
    markThroughCutoff(data,"2026-02-13");
    const person=buildLaborProjection(data,{asOf:"2026-02-13"}).people[0];
    expect(person.history.observedDays).toBe(20);
    expect(person.history.coverage).toBeLessThan(.8);
    expect(person.rate).toMatchObject({source:"unavailable",value:null});
  });

  it("respeita admissão, desligamento e ausência entre desligamento e reativação",()=>{
    const data=fixture(baseEmployee({startDate:"2026-01-01"}));
    data.changeLog=[{type:"dismissal",empId:"e1",date:"2026-01-13"},{type:"reactivation",empId:"e1",date:"2026-02-10"}];
    fillHistory(data,"2026-02-13");
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.people[0].days[0].date).toBe("2026-02-10");
    expect(report.people[0].history.observedDays).toBe(8); // 2, 5–9, 12–13 de janeiro
    const scheduled=fixture(baseEmployee({startDate:"2026-02-10",endDate:"2026-02-17"}));
    const days=buildLaborProjection(scheduled,{asOf:"2026-02-13"}).people[0].days.map(day=>day.date);
    expect(days).toEqual(["2026-02-10","2026-02-11","2026-02-12","2026-02-13","2026-02-16","2026-02-17"]);
  });

  it("sem datas essenciais sinaliza parcelas indisponíveis em vez de presumir continuidade",()=>{
    const data=fixture(baseEmployee({startDate:"",active:false}));
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.totals).toMatchObject({partial:true,projectedCost:0,fullAttendanceReserve:0});
    expect(report.people[0].days.every(day=>day.totalCost===null&&day.reserveCost===null)).toBe(true);
    expect(report.issues.some(issue=>issue.code==="EMPLOYMENT_START_MISSING")).toBe(true);
  });

  it("reativação sem desligamento anterior não inventa vínculo completo no histórico",()=>{
    const data=fixture();
    data.changeLog=[{type:"reactivation",empId:"e1",date:"2026-02-06"}];
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.people[0].history.observedDays).toBe(0);
    expect(report.people[0].rate.value).toBeNull();
    expect(report.people[0].history.coverage).toBe(0);
    expect(report.issues.some(issue=>issue.code==="EMPLOYMENT_HISTORY_INCOMPLETE")).toBe(true);
  });

  it.each([[19,19,"unavailable"],[25,20,"individual"],[25,19,"unavailable"]])("aplica limites exatamente com %i dias previstos e %i observados",(expected,observed,source)=>{
    const data=fixture();
    const dates=fillHistory(data,"2026-02-13");
    const selected=dates.slice(-expected);
    data.employees[0].startDate=selected[0];
    data.attendance.e1=Object.fromEntries(selected.slice(0,observed).map(date=>[date,{status:"P"}]));
    const person=buildLaborProjection(data,{asOf:"2026-02-13"}).people[0];
    expect(person.history).toMatchObject({expectedDays:expected,observedDays:observed,coverage:observed/expected});
    expect(person.rate.source).toBe(source);
  });
});

describe("parcelas do ciclo e motor canônico",()=>{
  it("preserva custo já apurado quando a taxa histórica muda",()=>{
    const data=fixture();
    historyFor(data,"2026-02-13",0,60);
    markThroughCutoff(data,"2026-02-13");
    const first=buildLaborProjection(data,{asOf:"2026-02-13"});
    historyFor(data,"2026-02-13",30,60);
    markThroughCutoff(data,"2026-02-13");
    const second=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(first.totals.actualCost).toBe(900);
    expect(second.totals.actualCost).toBe(900);
    expect(second.totals.estimatedCost).toBeLessThan(first.totals.estimatedCost);
  });

  it("M tem probabilidade própria e não aumenta o numerador de faltas",()=>{
    const data=fixture(baseEmployee({dailyRate:100,vtDaily:10,vrDaily:10}));
    const dates=fillHistory(data,"2026-02-13","e1",(_date,index)=>index<6?"F":index<18?"M":"P");
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    const person=report.people[0],day=person.days.find(day=>day.date==="2026-02-16");
    expect(person.rate.value).toBe(6/dates.length);
    expect(person.rate.halfDayProbability).toBe(12/dates.length);
    expect(person.rate.presentProbability+person.rate.halfDayProbability+person.rate.value).toBeCloseTo(1,14);
    const weight=(dates.length-18+6)/dates.length;
    expect(day.totalCost).toBe(Math.round(weight*100*100)/100+Math.round(weight*20*100)/100);
    expect(day.workedDaysWeight).toBe(weight);
  });

  it("mantém FE/AT/FG futuros confirmados fora da reserva de presença ordinária",()=>{
    const data=fixture(baseEmployee({vtDaily:20,vrDaily:30}));
    fillHistory(data,"2026-02-13");
    data.attendance.e1["2026-02-16"]={status:"FE",ot:8};
    data.attendance.e1["2026-02-17"]={status:"AT"};
    data.attendance.e1["2026-02-18"]={status:"FG"};
    const days=buildLaborProjection(data,{asOf:"2026-02-13"}).people[0].days;
    expect(days.find(day=>day.date==="2026-02-16")).toMatchObject({partition:"confirmedFuture",laborCost:150,benefitCost:0,totalCost:150,reserveCost:150,workedDaysWeight:0});
    expect(days.find(day=>day.date==="2026-02-17")).toMatchObject({partition:"confirmedFuture",totalCost:150,reserveCost:150});
    expect(days.find(day=>day.date==="2026-02-18")).toMatchObject({partition:"confirmedFuture",totalCost:0,reserveCost:0});
  });

  it("F futuro fica explícito e P futuro não vira custo apurado",()=>{
    const data=fixture();
    historyFor(data,"2026-02-13",6,60);
    data.attendance.e1["2026-02-16"]={status:"F"};
    data.attendance.e1["2026-02-17"]={status:"P"};
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.people[0].days.find(day=>day.date==="2026-02-16")).toMatchObject({partition:"confirmedFuture",totalCost:0,reserveCost:0});
    expect(report.people[0].days.find(day=>day.date==="2026-02-17")).toMatchObject({partition:"estimated",totalCost:135,reserveCost:150});
    expect(report.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(["FUTURE_ABSENCE_RECORDED","UNCONFIRMED_FUTURE_ATTENDANCE"]));
  });

  it("inclui hora extra só no dia explicitamente previsto",()=>{
    const data=fixture(baseEmployee({dailyRate:160,workdayHours:8,overtimeAdditionalPercent:50}));
    fillHistory(data,"2026-02-13");
    data.attendance.e1["2026-02-13"]={status:"P",ot:2};
    data.attendance.e1["2026-02-16"]={status:"P",ot:3};
    const days=buildLaborProjection(data,{asOf:"2026-02-13"}).people[0].days;
    expect(days.find(day=>day.date==="2026-02-13").totalCost).toBe(220);
    expect(days.find(day=>day.date==="2026-02-16")).toMatchObject({partition:"estimated",totalCost:250,reserveCost:250});
    expect(days.find(day=>day.date==="2026-02-17").totalCost).toBe(160);
  });

  it("preserva CLT fixo e denominadores de cada mês, mesmo com cem por cento de F",()=>{
    const data=fixture(baseEmployee({remunerationMode:"clt",monthlySalary:2310,vtDaily:20,vrDaily:10}));
    data.config.laborCharges=zeroCltCharges;
    fillHistory(data,"2026-10-29","e1",()=>"F");
    markThroughCutoff(data,"2026-10-29","F");
    const report=buildLaborProjection(data,{asOf:"2026-10-29"}),days=report.people[0].days;
    expect(report.people[0].rate.value).toBe(1);
    expect(sumCents(days.filter(day=>day.component==="salary"),"totalCost")/100).toBe(1280);
    expect(days.find(day=>day.date==="2026-10-30"&&day.component==="salary")).toMatchObject({partition:"confirmedFuture",totalCost:105,reserveCost:105,workedDaysWeight:0});
    expect(days.find(day=>day.date==="2026-11-03"&&day.component==="salary").totalCost).toBe(110);
    expect(days.find(day=>day.date==="2026-10-30"&&day.component==="attendance").totalCost).toBe(0);
    expect(report.totals.futureDays).toBe(5);
    const canonical=canonicalEngine().calculateWorkLaborCost({...data,archivedLaborCosts:{}},"o1",resolveActiveLaborPeriod("2026-10-29").days);
    expect(report.totals.laborCost).toBeCloseTo(canonical.laborCost,2);
  });

  it("CLT sem amostra mantém salário conhecido e explicita benefício futuro indisponível",()=>{
    const data=fixture(baseEmployee({startDate:"2026-10-29",remunerationMode:"clt",monthlySalary:2310,vtDaily:10}));
    data.config.laborCharges=zeroCltCharges;
    const report=buildLaborProjection(data,{asOf:"2026-10-29"});
    const days=report.people[0].days.filter(day=>day.date==="2026-10-30");
    expect(days.find(day=>day.component==="salary")).toMatchObject({totalCost:105,reserveCost:105});
    expect(days.find(day=>day.component==="attendance")).toMatchObject({totalCost:null,reserveCost:10});
    expect(report.totals).toMatchObject({partial:true,unpricedDays:4}); // 2/11 é feriado sem benefício
  });

  it("sinaliza fallback legado CLT por diária sem substituir o motor",()=>{
    const data=fixture(baseEmployee({remunerationMode:"clt",monthlySalary:0}));
    data.config.laborCharges=zeroCltCharges;
    fillHistory(data,"2026-02-13");
    markThroughCutoff(data,"2026-02-13");
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.issues.some(issue=>issue.code==="CLT_DAILY_FALLBACK")).toBe(true);
    expect(report.people[0].days.find(day=>day.date==="2026-02-13")).toMatchObject({component:"daily",totalCost:150});
  });

  it("segue modalidade vigente em cada data sem reduzir salário após a mudança",()=>{
    const data=fixture(baseEmployee({remunerationMode:"clt",monthlySalary:2000,remunerationHistory:[{date:"2026-02-16",mode:"clt"}]}));
    data.config.laborCharges=zeroCltCharges;
    fillHistory(data,"2026-02-13","e1",()=>"F");
    markThroughCutoff(data,"2026-02-13");
    const days=buildLaborProjection(data,{asOf:"2026-02-13"}).people[0].days;
    expect(days.find(day=>day.date==="2026-02-13")).toMatchObject({mode:"daily",component:"daily",totalCost:150});
    expect(days.find(day=>day.date==="2026-02-16"&&day.component==="salary")).toMatchObject({mode:"clt",totalCost:100});
  });
});

describe("alocação, escopo e reconciliação",()=>{
  it("transfere parcelas por data e preserva a taxa individual no filtro de obra",()=>{
    const data=fixture(baseEmployee({obra:"o2",obraHistory:[{date:"2026-02-16",fromObraId:"o1",toObraId:"o2"}]}));
    historyFor(data,"2026-02-13",6,60);
    markThroughCutoff(data,"2026-02-13");
    const full=buildLaborProjection(data,{asOf:"2026-02-13"});
    const filtered=buildLaborProjection(data,{asOf:"2026-02-13",filters:{obraId:"o2"},includeCashBasis:true});
    expect(full.totals.employeeCount).toBe(1);
    expect(full.groups.map(group=>group.obraId)).toEqual(["o1","o2"]);
    expect(filtered.people[0].rate).toEqual(full.people[0].rate);
    expect(filtered.people[0].history).toEqual(full.people[0].history);
    expect(filtered.people[0].days.every(day=>day.obraId==="o2"&&day.date>="2026-02-16")).toBe(true);
    expect(filtered._cashBasis.people[0].days.some(day=>day.obraId==="o1")).toBe(true);
    expect(filtered._cashBasis.people[0].days.every(day=>Object.hasOwn(day,"workedDaysWeight"))).toBe(true);
    expect(full._cashBasis).toBeUndefined();
    expect(sumCents(full.groups,"projectedCost")).toBe(Math.round(full.totals.projectedCost*100));
  });

  it("restrição de obra limita também história, opções e memória individual",()=>{
    const data=fixture(baseEmployee({obra:"o2",obraHistory:[{date:"2026-02-16",fromObraId:"o1",toObraId:"o2"}]}));
    historyFor(data,"2026-02-13",6,60);
    markThroughCutoff(data,"2026-02-13");
    const report=buildLaborProjection(data,{asOf:"2026-02-13",access:{allowedWorkIds:["o2"],includeAdministrative:false}});
    expect(report.people[0].history.observedDays).toBe(0);
    expect(report.people[0].rate.value).toBeNull();
    expect(report.people[0].days.every(day=>day.obraId==="o2")).toBe(true);
    expect(report.options.works).toEqual([{id:"o2",name:"Obra 2"}]);
    expect(JSON.stringify(report)).not.toContain('"o1"');
  });

  it("aviso de ponto fora da escala não revela data de outra obra",()=>{
    const data=fixture(baseEmployee({obra:"o2",obraHistory:[{date:"2026-02-16",fromObraId:"o1",toObraId:"o2"}]}));
    data.attendance.e1={"2026-02-07":{status:"P",obraId:"o1"}};
    const full=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(full.issues.some(issue=>issue.code==="OFF_SCHEDULE_ATTENDANCE"&&issue.date==="2026-02-07")).toBe(true);
    const restricted=buildLaborProjection(data,{asOf:"2026-02-13",access:{allowedWorkIds:["o2"],includeAdministrative:false}});
    expect(restricted.issues.some(issue=>issue.date==="2026-02-07")).toBe(false);
  });

  it.each([{dailyRate:null},{dailyRate:"inválida"},{vtDaily:-1},{vrDaily:Infinity}])("remuneração ou benefício inválido permanece nulo e parcial: %j",invalid=>{
    const data=fixture(baseEmployee(invalid));
    fillHistory(data,"2026-02-13");
    markThroughCutoff(data,"2026-02-13");
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.totals.partial).toBe(true);
    expect(report.people[0].days.every(day=>day.totalCost===null&&day.reserveCost===null)).toBe(true);
    expect(report.issues.some(issue=>["REMUNERATION_MISSING","INVALID_BENEFITS"].includes(issue.code))).toBe(true);
  });

  it("não confunde obra admin_only com administrativo e mantém sem lotação visível",()=>{
    const data=fixture();
    data.obras[0].contractType="admin_only";
    data.employees.push(baseEmployee({id:"office",workArea:"administrativo",obra:""}),baseEmployee({id:"unassigned",workArea:"campo",obra:""}));
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.groups.map(group=>group.kind)).toEqual(expect.arrayContaining(["work","administrative","unassigned"]));
    expect(report.people.find(person=>person.id==="e1").days[0].groupId).toBe("work:o1");
    expect(report.people.find(person=>person.id==="unassigned").days[0].groupId).toBe("unassigned");
    expect(report.issues.some(issue=>issue.code==="UNASSIGNED_ALLOCATION")).toBe(true);
  });

  it("snapshot sem área preserva obra histórica de quem hoje é administrativo",()=>{
    const data=fixture(baseEmployee({workArea:"administrativo",obra:""}));
    const dates=fillHistory(data,"2026-02-13");
    const snapshots=Object.fromEntries(dates.map(date=>[date,{e1:{obra:"o1",dailyRate:100}}]));
    const report=buildLaborProjection(data,{asOf:"2026-02-13",employeeSnapshotsByDate:snapshots});
    expect(report.groups[0].kind).toBe("administrative");
    expect(report.people[0].history.observedDays).toBe(dates.length);
    expect(report.groups[0].history.observedDays).toBe(0);
  });

  it("preserva taxas congeladas por data e não duplica archivedLaborCosts",()=>{
    const data=fixture(baseEmployee({dailyRate:250}));
    fillHistory(data,"2026-02-13");
    data.attendance.e1["2026-02-13"]={status:"P",obraId:"o1",archivedDailyRate:120,archivedVtDaily:5,archivedVrDaily:10};
    data.archivedLaborCosts={old:{byDate:{"2026-02-13":{o1:{laborCost:9000,benefitCost:8000}}}}};
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.people[0].days.find(day=>day.date==="2026-02-13")).toMatchObject({laborCost:120,benefitCost:15,totalCost:135});
  });

  it("arredonda parcelas em centavos e totaliza componentes sem somar encargos novamente",()=>{
    const data=fixture(baseEmployee({dailyRate:123.45,vtDaily:7.77,vrDaily:19.99}));
    data.config.laborCharges.diaristaPercent=17.3;
    data.employees.push(baseEmployee({id:"e2",obra:"o2",dailyRate:98.76,vtDaily:6.33}));
    for(const employee of data.employees){historyFor(data,"2026-02-13",7,60,employee.id);markThroughCutoff(data,"2026-02-13","M",employee.id);}
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    const days=report.people.flatMap(person=>person.days);
    for(const day of days)expect(Math.round(day.totalCost*100)).toBe(Math.round(day.laborCost*100)+Math.round(day.benefitCost*100));
    expect(sumCents(days,"totalCost")).toBe(Math.round(report.totals.projectedCost*100));
    expect(sumCents(report.people,"projectedCost")).toBe(sumCents(report.groups,"projectedCost"));
    expect(sumCents(report.groups,"projectedCost")).toBe(Math.round(report.totals.projectedCost*100));
    expect(report.totals.chargesCost).toBeGreaterThan(0);
    expect(Math.round(report.totals.projectedCost*100)).toBe(Math.round(report.totals.laborCost*100)+Math.round(report.totals.benefitCost*100));
  });

  it("não altera dados, ponto, arquivos ou pagamentos recebidos",()=>{
    const data=fixture();
    fillHistory(data,"2026-02-13");
    data.pagamentosFolha=[{id:"paid",valor:100}];
    data.titulosFolha=[{id:"title",valor:300}];
    data.archivedLaborCosts={archive:{byDate:{}}};
    const before=JSON.stringify(data);
    deepFreeze(data);
    expect(()=>buildLaborProjection(data,deepFreeze({asOf:"2026-02-13",filters:{obraId:"o1"},includeCashBasis:true}))).not.toThrow();
    expect(JSON.stringify(data)).toBe(before);
  });

  it("não inventa contrato fixo, MEI sem valor ou terceiros por fator mensal",()=>{
    const data=fixture(baseEmployee({remunerationMode:"fixed"}));
    data.terceirizados=[{id:"contract",weeklyRate:1000,active:true}];
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.totals).toMatchObject({partial:true,projectedCost:0});
    expect(report.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(["UNSUPPORTED_REMUNERATION","THIRD_PARTY_NOT_INCLUDED"]));
    expect(report.people[0].days.every(day=>day.totalCost===null)).toBe(true);
    const mei=buildLaborProjection(fixture(baseEmployee({remunerationMode:"mei",dailyRate:0})),{asOf:"2026-02-13"});
    expect(mei.issues.map(issue=>issue.code)).toContain("REMUNERATION_MISSING");
    expect(mei.people[0].days.every(day=>day.totalCost===null)).toBe(true);
  });
});

describe("feriados e qualidade visível",()=>{
  it("feriado futuro mantém regra canônica e explicita vizinho e alocação condicionais",()=>{
    const data=fixture();
    fillHistory(data,"2026-10-29");
    markThroughCutoff(data,"2026-10-29");
    const report=buildLaborProjection(data,{asOf:"2026-10-29"});
    const holiday=report.people[0].days.find(day=>day.date==="2026-11-02");
    expect(holiday).toMatchObject({status:"HOLIDAY",partition:"estimated",totalCost:150,reserveCost:150,provisional:true});
    expect(holiday.issueCodes).toEqual(expect.arrayContaining(["HOLIDAY_CONDITIONAL","HOLIDAY_ALLOCATION_CONDITIONAL"]));
    expect(report.totals.partial).toBe(false);
    expect(report.totals.provisional).toBe(true);
  });

  it("CLT mensal não recebe condição de perda de salário por falta vizinha ao feriado",()=>{
    const data=fixture(baseEmployee({remunerationMode:"clt",monthlySalary:2310}));
    data.config.laborCharges=zeroCltCharges;
    fillHistory(data,"2026-10-29");
    const holiday=buildLaborProjection(data,{asOf:"2026-10-29"}).people[0].days.find(day=>day.date==="2026-11-02");
    expect(holiday).toMatchObject({component:"salary",partition:"confirmedFuture",totalCost:110});
    expect(holiday.issueCodes).not.toContain("HOLIDAY_CONDITIONAL");
    expect(holiday.issueCodes).toContain("HOLIDAY_ALLOCATION_CONDITIONAL");
  });

  it("F vizinha confirmada retira feriado conforme o motor e reserva não o repõe",()=>{
    const data=fixture();
    fillHistory(data,"2026-10-29");
    markThroughCutoff(data,"2026-10-29");
    data.attendance.e1["2026-10-30"]={status:"F"};
    const holiday=buildLaborProjection(data,{asOf:"2026-10-29"}).people[0].days.find(day=>day.date==="2026-11-02");
    expect(holiday).toMatchObject({partition:"confirmedFuture",totalCost:0,reserveCost:0});
    expect(holiday.issueCodes).not.toContain("HOLIDAY_CONDITIONAL");
  });

  it("feriado pertence ao último P/M e não à obra escrita no próprio feriado",()=>{
    const data=fixture(baseEmployee({obra:"o2",obraHistory:[{date:"2026-11-02",fromObraId:"o1",toObraId:"o2"}]}));
    fillHistory(data,"2026-10-29");
    markThroughCutoff(data,"2026-10-30");
    data.attendance.e1["2026-11-02"]={status:"P",obraId:"o2"};
    const holiday=buildLaborProjection(data,{asOf:"2026-10-30"}).people[0].days.find(day=>day.date==="2026-11-02");
    expect(holiday.obraId).toBe("o1");
    expect(holiday.issueCodes).not.toContain("HOLIDAY_ALLOCATION_CONDITIONAL");
  });

  it("reconhece feriados no segundo ano da mesma quinzena",()=>{
    const data=fixture(baseEmployee({startDate:"2024-01-01",vtDaily:20,vrDaily:30}));
    fillHistory(data,"2025-12-29");
    markThroughCutoff(data,"2025-12-29");
    const holiday=buildLaborProjection(data,{asOf:"2025-12-29"}).people[0].days.find(day=>day.date==="2026-01-01");
    expect(holiday).toMatchObject({status:"HOLIDAY",totalCost:150,benefitCost:0,reserveCost:150});
  });

  it("classificação legada é limitação de estimativa, sem reclassificar nota livre",()=>{
    const data=fixture();
    historyFor(data,"2026-02-13",6,60);
    Object.values(data.attendance.e1).forEach(record=>{record.note="Informação privada que nunca deve sair no relatório";});
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.people[0].rate).toMatchObject({value:.1,limitedClassification:true});
    expect(report.totals.provisional).toBe(true);
    expect(report.issues.some(issue=>issue.code==="HISTORICAL_CLASSIFICATION_LIMITED")).toBe(true);
    expect(JSON.stringify(report)).not.toContain("Informação privada");
  });

  it("fontes explicitamente classificadas não recebem limitação legada automaticamente",()=>{
    const data=fixture();
    const dates=historyFor(data,"2026-02-13",6,60);
    const attendanceSources={e1:Object.fromEntries(dates.map(date=>[date,{kind:"restored",limitedClassification:false}]))};
    const report=buildLaborProjection(data,{asOf:"2026-02-13",attendanceSources});
    expect(report.people[0].rate.limitedClassification).toBe(false);
  });

  it("limitação de área histórica sem omissão de custo é provisória, não subtotal indisponível",()=>{
    const data=fixture();
    fillHistory(data,"2026-02-13");
    markThroughCutoff(data,"2026-02-13");
    const report=buildLaborProjection(data,{asOf:"2026-02-13",historyIssues:[{code:"LABOR_ARCHIVE_WORK_AREA_UNKNOWN",affectsHistory:false}]});
    expect(report.totals).toMatchObject({partial:false,provisional:true,unpricedDays:0});
  });
});

describe("revisão 29/10: obra do dia sem ponto, início do histórico e diaristas parados",()=>{
  it("dia sem ponto vai para a obra do último dia trabalhado, não para a lotação desatualizada",()=>{
    const data=fixture(baseEmployee({obra:"o1"}));
    fillHistory(data,"2026-02-13","e1",()=>({status:"P",obraId:"o2"}));
    for(const date of ["2026-02-06","2026-02-09","2026-02-10","2026-02-11","2026-02-12"])data.attendance.e1[date]={status:"P",obraId:"o2"};
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    // 13/02 está pendente e os dias seguintes são futuros: todos na o2.
    expect(report.groups.map(group=>group.obraId)).toEqual(["o2"]);
    expect(report.people[0].days.filter(day=>day.date>="2026-02-13").every(day=>day.obraId==="o2")).toBe(true);
  });

  it("transferência registrada depois do último dia trabalhado prevalece",()=>{
    const data=fixture(baseEmployee({obra:"o2",obraHistory:[{date:"2026-02-16",fromObraId:"o1",toObraId:"o2"}]}));
    fillHistory(data,"2026-02-13","e1",()=>({status:"P",obraId:"o1"}));
    markThroughCutoff(data,"2026-02-13");
    const days=buildLaborProjection(data,{asOf:"2026-02-13"}).people[0].days;
    expect(days.filter(day=>day.date>="2026-02-16").every(day=>day.obraId==="o2")).toBe(true);
    expect(days.filter(day=>day.date<"2026-02-16").every(day=>day.obraId==="o1")).toBe(true);
  });

  it("dias anteriores ao primeiro ponto da empresa não derrubam a cobertura",()=>{
    const data=fixture();
    const window=resolveLaborHistoryWindow(resolveActiveLaborPeriod("2026-02-13",data));
    // Sistema começou um mês depois da abertura da janela histórica.
    const start=datesBetween(window.startDate,window.endDate)[31];
    fillHistory(data,"2026-02-13","e1",date=>date>=start?(Number(date.slice(8))%10===0?"F":"P"):null);
    markThroughCutoff(data,"2026-02-13");
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.history.trackingStart).toBe(Object.keys(data.attendance.e1).sort()[0]);
    expect(report.people[0].history.coverage).toBe(1);
    expect(report.people[0].rate.source).toBe("individual");
    expect(report.totals.unpricedDays).toBe(0);
    expect(report.assumptions.some(text=>text.includes("primeiro lançamento"))).toBe(true);
  });

  it("diarista ativo sem ponto há 30 dias sai do subtotal com pendência; CLT e admissão recente ficam",()=>{
    const data=fixture();
    data.employees.push(
      baseEmployee({id:"parado",obra:"o2"}),
      baseEmployee({id:"clt",obra:"o2",remunerationMode:"clt",monthlySalary:3000}),
      baseEmployee({id:"novo",obra:"o2",startDate:"2026-02-02"}),
    );
    data.config.laborCharges={diaristaPercent:0,inssPatronalPercent:0,ratPercent:0,fap:1,terceirosPercent:0,fgtsPercent:0,multaFgtsPercent:0,provisionar13Ferias:false};
    fillHistory(data,"2026-02-13","e1");markThroughCutoff(data,"2026-02-13");
    data.attendance.parado={"2026-01-05":{status:"P",obraId:"o2"}};
    data.attendance.clt={"2026-01-05":{status:"P",obraId:"o2"}};
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    expect(report.people.map(person=>person.id).sort()).toEqual(["clt","e1","novo"]);
    expect(report.issues.filter(issue=>issue.code==="NO_RECENT_ATTENDANCE")).toEqual([expect.objectContaining({employeeId:"parado",obraId:"o2"})]);
    expect(report.totals.excludedStaleEmployees).toBe(1);
    // Filtro de outra obra não mostra a pendência do parado.
    expect(buildLaborProjection(data,{asOf:"2026-02-13",filters:{obraId:"o1"}}).issues.some(issue=>issue.code==="NO_RECENT_ATTENDANCE")).toBe(false);
  });
});

describe("MEI na projeção",()=>{
  it("valor fixo mensal entra como confirmado, sem ponto pendente, encargos ou benefícios",()=>{
    const data=fixture(baseEmployee({id:"e1",remunerationMode:"mei",meiMonthlyValue:4400,dailyRate:0,vtDaily:10,vrDaily:20}));
    data.config.laborCharges={diaristaPercent:10,inssPatronalPercent:20,ratPercent:3,fap:1,terceirosPercent:5.8,fgtsPercent:8,multaFgtsPercent:40,provisionar13Ferias:true};
    const report=buildLaborProjection(data,{asOf:"2026-02-13"});
    const person=report.people[0];
    expect(person.mode).toBe("mei");
    expect(person.days.every(day=>day.component==="salary"&&["actual","confirmedFuture"].includes(day.partition))).toBe(true);
    expect(report.issues.map(issue=>issue.code)).not.toContain("PENDING_ATTENDANCE");
    expect(report.issues.map(issue=>issue.code)).not.toContain("UNSUPPORTED_REMUNERATION");
    expect(report.totals).toMatchObject({chargesCost:0,benefitCost:0,unpricedDays:0,pendingCost:0,estimatedCost:0});
    // Fevereiro/2026: cada dia útil vale 4.400 ÷ dias úteis do mês.
    const uteis=Array.from({length:28},(_,i)=>`2026-02-${String(i+1).padStart(2,"0")}`).filter(prIsWeekdayIso).length;
    expect(person.days[0].laborCost).toBeCloseTo(Math.round(4400/uteis*100)/100,2);
    expect(report.history.expectedDays).toBe(0);
  });
});


it("administração local usa central sem perder obra responsável nem permissão da obra",()=>{
 const data=fixture(baseEmployee({role:"Mestre de obras"}));data.obras[0].contractType="admin_only";data.attendance.e1={"2026-10-21":{status:"P",obraId:"o1"}};
 const report=buildLaborProjection(data,{asOf:"2026-10-29",access:{allowedWorkIds:["o1"],includeAdministrative:false},filters:{area:"administrative"}});
 expect(report.people).toHaveLength(1);expect(report.groups[0]).toMatchObject({kind:"administrative",obraId:"o1",name:"Administração Central · Obra 1"});
 expect(report.people[0].days.every(day=>day.obraId==="o1")).toBe(true);
 expect(buildLaborProjection(data,{asOf:"2026-10-29",filters:{area:"works"}}).people).toHaveLength(0);
});
