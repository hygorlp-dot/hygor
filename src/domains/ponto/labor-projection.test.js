import { describe,expect,it } from "vitest";
import { projectionPeriod,businessDate,projectionArchiveKeys,dateRange } from "./labor-projection.js";
import { buildLaborProjection,summarizeHistory,laborProjectionAccess } from "../../../server/labor-projection.js";
import { composeLaborProjectionSource } from "../../../server/labor-projection-source.js";
import { getPayrollHolidays,prIsWeekdayIso } from "./attendance-engine.js";
import { laborArea } from "../rh/labor-area.js";
import { laborProjectionHtml,laborProjectionSheets } from "../../reports/labor-projection.js";
const admin={id:"u",role:"admin"};
const employee={id:"e",name:"Funcionário sintético",role:"Pedreiro",dailyRate:150,obra:"o",startDate:"2025-01-01",active:true};
function fixture(date="2026-09-14") {
 const period=projectionPeriod(date),attendance={};
 for(const [intervalIndex,interval] of period.intervals.entries()){const dates=dateRange(interval.start,interval.end).filter(day=>prIsWeekdayIso(day)&&!getPayrollHolidays({},Number(day.slice(0,4))).includes(day)).slice(0,[19,21,20][intervalIndex]);dates.forEach((day,index)=>{attendance[day]={status:index<2?"F":"P",obraId:"o"};});}
 for(const day of dateRange(period.historyStart,period.historyEnd)){if(Object.keys(attendance).length>=60)break;if(prIsWeekdayIso(day)&&!getPayrollHolidays({},Number(day.slice(0,4))).includes(day)&&!attendance[day])attendance[day]={status:"P",obraId:"o"};}
 for(const day of period.dates.filter(day=>day<=date&&prIsWeekdayIso(day)))attendance[day]={status:"P",obraId:"o"};
 if(date==="2026-08-14")attendance[period.start]={status:"F",obraId:"o"};
 return {employees:[{...employee}],attendance:{e:attendance},obras:[{id:"o",name:"Obra A",contractType:"admin_only"}],config:{},advances:[],changeLog:[]};
}
const run=(data,extra={})=>buildLaborProjection({data,user:admin,instant:"2026-09-14T15:00:00Z",...extra});
describe("projeção quinzenal canônica",()=>{
 it.each([["2026-11-01","2026-10-21","2026-11-05"],["2026-11-05","2026-10-21","2026-11-05"],["2026-11-06","2026-11-06","2026-11-20"],["2026-11-20","2026-11-06","2026-11-20"],["2026-11-21","2026-11-21","2026-12-05"],["2027-01-01","2026-12-21","2027-01-05"],["2024-02-29","2024-02-21","2024-03-05"]])("resolve data %s",(date,start,end)=>{expect(projectionPeriod(date)).toMatchObject({start,end});});
 it("mantém janela de três meses-calendário entre outubro e novembro, em fuso empresarial",()=>{
  for(const day of ["2026-10-29","2026-11-01"])expect(projectionPeriod(day)).toMatchObject({key:"2026-10-Q2",historyStart:"2026-07-21",historyEnd:"2026-10-20",intervals:[{start:"2026-07-21",end:"2026-08-20"},{start:"2026-08-21",end:"2026-09-20"},{start:"2026-09-21",end:"2026-10-20"}]});
  expect(businessDate("2026-11-06T01:00:00Z")).toBe("2026-11-05");
 });
 it("pondera 2/10 + 1/20 + 3/30 como 6/60",()=>{
  const stats=summarizeHistory([[2,10],[1,20],[3,30]].map(([absences,observed])=>({absences,observed,expected:observed,half:0,leaves:0,pending:0})));
  expect(stats.rate).toBe(.1);
 });
 it("900 apurados mais quatro dias a 150 com 10% =1440; reserva integral 1500",()=>{
  const data=fixture("2026-08-14"),before=JSON.stringify(data),result=run(data,{instant:"2026-08-14T15:00:00Z"});
  expect(result.totals.knownCents).toBe(90000);expect(result.totals.estimatedCents).toBe(54000);expect(result.totals.totalCents).toBe(144000);expect(result.totals.reserveCents).toBe(150000);
  expect(result.people[0].history.rate).toBe(.1);expect(result.people[0].history.origin).toBe("individual");expect(JSON.stringify(data)).toBe(before);
  expect(result.works.reduce((sum,work)=>sum+work.totalCents,0)).toBe(result.totals.totalCents);
  expect(result.people.reduce((sum,person)=>sum+person.totals.totalCents,0)).toBe(result.totals.totalCents);
 });
 it("não modifica o apurado ao variar a frequência e não inventa falta para vazio ou batida incompleta",()=>{
  const data=fixture(),known=run(data).totals.knownCents;
  for(const date of Object.keys(data.attendance.e).filter(date=>date<"2026-09-06"))data.attendance.e[date].status="P";
  expect(run(data).totals.knownCents).toBe(known);
  delete data.attendance.e["2026-09-14"];data.attendance.e["2026-09-11"]={entrada:"07:00"};
  const result=run(data);expect(result.totals.pendingDays).toBe(3);expect(result.pending.some(item=>item.reason.includes("Feriado condicionado"))).toBe(true);expect(result.people[0].history.rate).toBe(0);
 });
 it("separa M e afastamentos da taxa e exige cobertura suficiente",()=>{
  const data=fixture();for(const date of Object.keys(data.attendance.e).filter(date=>date<"2026-09-06").slice(0,4))data.attendance.e[date].status=["M","FE","AT","FG"][Object.keys(data.attendance.e).filter(d=>d<"2026-09-06").slice(0,4).indexOf(date)];
  const result=run(data);expect(result.people[0].history.personal.half).toBe(1);expect(result.people[0].history.personal.leaves).toBe(3);
  const empty=run({...data,attendance:{e:{}}});expect(empty.totals.totalCents).toBeNull();expect(empty.totals.reserveCents).toBeGreaterThan(0);expect(empty.people[0].history.origin).toBe("indisponível");
 });
 it("preserva CLT pelo denominador útil e encargos, sem desconto por taxa elevada",()=>{
  const data=fixture();data.employees[0]={...employee,remunerationMode:"clt",remunerationEffectiveFrom:"2025-01-01",monthlySalary:2200};
  for(const date of Object.keys(data.attendance.e).filter(day=>day<"2026-09-06"))data.attendance.e[date].status="F";
  const result=run(data);expect(result.people[0].history.rate).toBe(1);expect(result.totals.laborCents).toBeGreaterThan(100000);expect(result.cash.netCents).toBeNull();
  expect(result.totals.totalCents).toBe(result.totals.reserveCents);
 });
 it("separa central, sem lotação, transferências e limita vínculo",()=>{
  expect(laborArea({...employee,role:"Mestre de obras"})).toBe("central");expect(laborArea({...employee,role:"Engenheira civil"})).toBe("central");
  const data=fixture();data.employees.push({...employee,id:"a",workArea:"administrativo",obra:""});
  const result=run(data);expect(result.works.map(work=>work.label)).toContain("Administração Central");
  data.employees[1].workArea="campo";expect(run(data).works.map(work=>work.label)).toContain("Sem lotação definida");
  data.employees[0].endDate="2026-09-14";expect(run(data).people.find(person=>person.id==="e").days.every(day=>day.date<="2026-09-14")).toBe(true);
 });
 it("fotografia fechada prevalece; restaurada usa vivo; sobreposição conflitante não vira falta",()=>{
  const data=fixture();data.quinzenasArquivadas={"2026-08-Q1":{}};
  const archive={id:"2026-08-Q1",archive:{employeesSnapshot:[employee],attendance:{e:{"2026-08-10":{status:"F"}}}}};
  data.attendance.e["2026-08-10"]={status:"P"};
  const source=composeLaborProjectionSource(data,[archive],"2026-06-06","2026-09-20");expect(source.data.attendance.e["2026-08-10"].status).toBe("F");
  expect(source.data.attendance.e["2026-09-14"].status).toBe("P");
  data.quinzenasRestauradas={"2026-08-Q1":{restoredAt:"2026-08-21"}};
  expect(composeLaborProjectionSource(data,[archive],"2026-06-06","2026-09-20").data.attendance.e["2026-08-10"].status).toBe("P");
  expect(projectionArchiveKeys({"2026-07-Q1":{},"2026-07-Q2":{},"2026-11-Q1":{}},"2026-07-21","2026-10-20")).toEqual(["2026-07-Q2"]);
 });
 it("arquivo ausente suspende taxa e permissões removem toda memória individual",()=>{
  const data=fixture();expect(run(data,{archiveSource:{archives:[],missing:["2026-08-Q1"],versions:[]}}).coverage.partial).toBe(true);
  expect(laborProjectionAccess(null).status).toBe(401);
  expect(laborProjectionAccess({role:"financeiro",accessTabs:["fin"]}).status).toBe(403);
  expect(laborProjectionAccess({role:"rh",obraId:"o"},{obraId:"outra"}).status).toBe(403);
  const result=run(data,{user:{role:"financeiro"}});expect(result.canSeePeople).toBe(false);expect(result.people).toBeUndefined();expect(result.memory).toBeUndefined();
  const exported=JSON.stringify(laborProjectionSheets(result));expect(exported).not.toContain(employee.name);expect(exported).not.toContain('"Memória de cálculo"');
  expect(laborProjectionHtml(result)).toContain(result.version);
 });
 it("título fechado substitui líquido estimado, pagamento parcial reduz só saldo, estorno é preservado",()=>{
  const data=fixture();data.titulosFolha=[{id:"t",periodKey:"2026-09-Q1",employeeId:"e",liquido:1000,liquidacoes:[{valor:300},{valor:200,status:"estornado"}]}];
  const result=run(data);expect(result.cash.netCents).toBe(100000);expect(result.cash.balanceCents).toBe(70000);expect(result.totals.totalCents).toBe(run(fixture()).totals.totalCents);
  data.advances=[{empId:"e",amount:300,date:"2026-09-10"}];expect(run(data).cash.netCents).toBe(100000);
 });
 it("fallback respeita função, área, modalidade e jornada; nunca inventa taxa",()=>{
  const data=fixture();data.employees.push({...employee,id:"novo",startDate:"2026-09-01"});data.attendance.novo={"2026-09-02":{status:"P",obraId:"o"}};
  let result=run(data);expect(result.people.find(person=>person.id==="novo").history.origin).toBe("grupo comparável");
  data.employees[1].role="Servente";result=run(data);expect(result.people.find(person=>person.id==="novo").history.rate).toBeNull();
 });
 it("eventos confirmados futuros preservam afastamento e a reserva não o transforma em P",()=>{
  const data=fixture("2026-08-14");data.attendance.e["2026-08-17"]={status:"FG"};
  const result=run(data,{instant:"2026-08-14T15:00:00Z"});const day=result.memory.find(day=>day.date==="2026-08-17");
  expect(day.partition).toBe("programado");expect(day.expectedCents).toBe(0);expect(day.reserveCents).toBe(0);
  expect(result.totals.reserveCents).toBe(135000);
 });
 it("cadastro só de arquivo não vira funcionário futuro, mas continua servindo ao histórico",()=>{
  const data=fixture();data.quinzenasArquivadas={"2026-07-Q1":{}};
  const result=run(data,{archiveSource:{archives:[{id:"2026-07-Q1",archive:{employeesSnapshot:[{...employee,id:"antigo"}],attendance:{antigo:{"2026-07-06":{status:"P"}}}}}],missing:[],versions:[]}});
  expect(result.people.some(person=>person.id==="antigo")).toBe(false);expect(result.coverage.archiveOnlyNotProjected).toBe(1);
 });
 it("pagamentos sem obrigação/período inequívocos deixam saldo indisponível",()=>{
  const data=fixture();data.pagamentosFolha=[{employeeId:"e",data:"2026-09-10",valor:300}];
  const result=run(data);expect(result.cash.balanceCents).toBeNull();expect(result.people[0].cash.paidCents).toBeNull();
  data.pagamentosFolha[0].status="estornado";expect(run(data).cash.balanceCents).not.toBeNull();
 });
 it("rateio de dois centavos com um pago reconcilia o escopo de uma obra",()=>{
  const data=fixture();data.titulosFolha=[{id:"t",periodKey:"2026-09-Q1",employeeId:"e",liquido:.02,valorPago:.01,rateiosPorObra:[{obraId:"o",valor:.01},{obraId:"x",valor:.01}]}];
  const result=run(data,{user:{role:"rh",obraId:"o"}});expect(result.cash.netCents).toBe(1);expect(result.cash.paidCents).toBe(1);expect(result.cash.balanceCents).toBe(0);
 });
 it("componentes e total diário reconciliam em centavos, com encargos incluídos uma vez",()=>{
  const data=fixture();data.employees[0].dailyRate=151.13;data.employees[0].vrDaily=13.27;data.config.laborCharges={diaristaPercent:20};
  const result=run(data);for(const day of result.memory)if(day.expectedCents!==null)expect(day.expectedCents).toBe(day.laborCents+day.benefitsCents);
  expect(result.totals.partialCents).toBe(result.totals.laborCents+result.totals.benefitsCents);
 });

 it("PDF mantém tabelas regulares no histórico e todas as exportações usam a mesma versão",()=>{
  const result=run(fixture()),doc=new DOMParser().parseFromString(laborProjectionHtml(result),"text/html");
  for(const table of doc.querySelectorAll("table")){const count=table.tHead.rows[0].cells.length;expect([...table.tBodies].flatMap(body=>[...body.rows]).every(row=>row.cells.length===count)).toBe(true);}
  expect(JSON.stringify(laborProjectionSheets(result))).toContain(result.version);expect(doc.body.textContent).toContain(result.version);
 });

 it("CLT Q2 mantém denominadores de cada mês e o mesmo centavo ao filtrar obra",()=>{
  const data=fixture("2026-10-29");data.employees[0]={...employee,remunerationMode:"clt",remunerationEffectiveFrom:"2025-01-01",monthlySalary:1000,obra:"b"};data.obras.push({id:"b",name:"Obra B"});
  data.config.laborCharges={inssPatronalPercent:0,ratPercent:0,terceirosPercent:0,fgtsPercent:0,multaFgtsPercent:0,provisionar13Ferias:false};
  for(const day of projectionPeriod("2026-10-29").dates)data.attendance.e[day]={status:"P",obraId:day<="2026-10-26"?"o":"b"};
  const combined=run(data,{instant:"2026-10-29T15:00:00Z"});
  for(const work of combined.works){const scoped=run(data,{instant:"2026-10-29T15:00:00Z",filters:{obraId:work.id}});expect(scoped.totals.totalCents).toBe(work.totalCents);}
  expect(combined.totals.totalCents).toBe(Math.round(1000/22*8*100)+Math.round(1000/21*4*100));
 });
 it("vínculo incompleto deixa pessoa e centro parciais, não apenas o consolidado",()=>{
  const data=fixture();delete data.employees[0].startDate;
  const result=run(data);expect(result.totals.totalCents).toBeNull();expect(result.people[0].totals.totalCents).toBeNull();expect(result.works[0].totalCents).toBeNull();expect(result.works[0].unknown).toBeGreaterThan(0);
 });

 it("reativação respeita o intervalo sem vínculo e mudança de modalidade não mistura a taxa",()=>{
  const data=fixture();data.changeLog=[{empId:"e",type:"dismissal",date:"2026-08-10"},{empId:"e",type:"reactivation",date:"2026-09-10"}];
  let result=run(data);expect(result.people[0].days.every(day=>day.date>="2026-09-10")).toBe(true);
  data.employees[0].monthlySalary=2200;data.employees[0].remunerationHistory=[{date:"2026-09-15",mode:"clt"}];
  result=run(data);expect(result.memory.filter(day=>day.date>="2026-09-15"&&day.component==="salário e encargos").every(day=>day.rate===null&&day.expectedCents>0)).toBe(true);
 });
 it("adiantamento parcelado reduz líquido uma vez, preserva custo e ignora parcelas fora do ciclo",()=>{
  const data=fixture("2026-08-14"),instant="2026-08-14T15:00:00Z",base=run(data,{instant});
  data.advances=[{empId:"e",amount:600,installments:[{dueDate:"2026-08-20",amount:100},{dueDate:"2026-09-05",amount:500}]}];
  const result=run(data,{instant});expect(result.totals.totalCents).toBe(base.totals.totalCents);expect(result.cash.netCents).toBe(base.cash.netCents-10000);
 });

});
