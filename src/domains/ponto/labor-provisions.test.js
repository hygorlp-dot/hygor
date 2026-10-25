import {expect,it} from "vitest";
import {calculateLaborProvision,laborProvisionDraftForEmployee,newProvisionDraft,provisionReferenceDate,summarizeLaborProvisions} from "./labor-provisions.js";
const draft=overrides=>({...newProvisionDraft({remunerationMode:"clt",startDate:"2026-01-01",monthlySalary:3000},"2026-09"),...overrides});
it("separa 13º, férias, terço, FGTS e multa contingente sem desconto do salário",()=>{
  const r=calculateLaborProvision(draft());
  expect(r).toMatchObject({thirteenth:250,vacation:250,vacationThird:83.33,fgtsOnThirteenth:20,fgtsOnVacation:26.67,normalFgts:240,fine:114.67,monthly:744.67,accumulated:null,contingentFine:null});
  expect(r.errors).toEqual([]);
});
it("não presume saldo acumulado ou base rescisória zero; calcula somente quando informado",()=>{
  const r=calculateLaborProvision(draft({openingMonth:"2026-07",openingBalance:1000,usedReserve:500,fgtsSeveranceBase:10000}));
  expect(r.months).toBe(3);expect(r.accumulated).toBe(2734.01);expect(r.contingentFine).toBe(4000);
  expect(calculateLaborProvision(draft({openingBalance:0,usedReserve:0})).accumulated).toBe(744.67);
  expect(calculateLaborProvision(draft({openingBalance:null,usedReserve:null,fgtsSeveranceBase:null}))).toMatchObject({accumulated:null,contingentFine:null,errors:[]});
  expect(calculateLaborProvision(draft({fgtsSeveranceBase:false})).errors.length).toBeGreaterThan(0);
});
it("adapta incidência de férias e cenário de multa sem extrapolar encargo para diária",()=>{
  expect(calculateLaborProvision(draft({fgtsOnVacation:false,finePercent:20}))).toMatchObject({fgtsOnVacation:0,fine:52,monthly:655.33});
  expect(newProvisionDraft({dailyRate:150,startDate:"2026-01-01"},"2026-09")).toMatchObject({included:false,base:""});
  expect(calculateLaborProvision(draft({base:0})).errors.length).toBeGreaterThan(0);
});
it("sinaliza totais parciais e excluídos, sem transformar dado ausente em zero",()=>{
  const rows=[{result:calculateLaborProvision(draft())},{result:calculateLaborProvision(draft({base:""}))},{result:calculateLaborProvision(draft({included:false}))}];
  expect(summarizeLaborProvisions(rows)).toMatchObject({employees:2,missing:1,monthly:744.67,missingAccumulated:2,missingFine:2});
});
it("mantém déficit visível sem eliminar a provisão mensal válida do total",()=>{
  const result=calculateLaborProvision(draft({openingBalance:0,usedReserve:2000}));
  expect(result.errors).toEqual([]);expect(result.accumulated).toBe(-1255.33);
  expect(summarizeLaborProvisions([{result}])).toMatchObject({missing:0,monthly:744.67,accumulated:-1255.33});
});
it("inclui CLT por diária como apuração pendente sem converter diária ou reaproveitar salário antigo",()=>{
  const employee={employmentRelationship:"clt",employmentRelationshipEffectiveFrom:"2026-10-06",remunerationMode:"daily",dailyRate:120,monthlySalary:3300,startDate:"2026-10-06"};
  const values=newProvisionDraft(employee,"2026-10"),result=calculateLaborProvision(values);
  expect(values).toMatchObject({included:true,base:"",assessmentMethod:"manual_daily_clt_reserve",fgtsPercent:"",finePercent:""});
  expect(result.errors.length).toBeGreaterThan(0);
  expect(summarizeLaborProvisions([{result}])).toMatchObject({employees:1,missing:1,monthly:0});
});
const dailyEmployee=()=>({employmentRelationship:'clt',employmentRelationshipEffectiveFrom:'2026-01-01',remunerationMode:'daily',dailyRate:120,startDate:'2026-01-01'});
const dailyAssessment=()=>({...newProvisionDraft(dailyEmployee(),'2026-10'),base:2550,average:50,fgtsPercent:8,finePercent:40,fgtsOnVacation:true,
  assessmentReference:'Memória QA-101 fictícia',assessmentResponsible:'Responsável fictício',assessmentMemory:'Base informada de 2550 e média de 50 para ensaio; incidências conferidas.',assessmentConfirmed:true});
it('usa base manual identificada e mantém a mesma fórmula sem inferir remuneração da diária',()=>{
  const result=calculateLaborProvision(dailyAssessment());
  expect(result.errors).toEqual([]);
  expect(result).toMatchObject({base:2600,thirteenth:216.67,vacation:216.67,vacationThird:72.22,normalFgts:208,monthly:645.38});
  for(const key of ['assessmentReference','assessmentResponsible','assessmentMemory'])expect(calculateLaborProvision({...dailyAssessment(),[key]:''}).errors.length).toBeGreaterThan(0);
  expect(calculateLaborProvision({...dailyAssessment(),assessmentConfirmed:false}).errors.length).toBeGreaterThan(0);
  expect(calculateLaborProvision({...dailyAssessment(),fgtsOnVacation:null}).errors.length).toBeGreaterThan(0);
  expect(calculateLaborProvision({...dailyAssessment(),included:false})).toMatchObject({included:true});
});
it('expõe exclusão antiga do CLT diário como pendência sem reescrever o registro salvo',()=>{
  const stored={...draft({included:false,base:''})},employee={...dailyEmployee(),laborProvisions:{'2026-10':stored}},before=structuredClone(employee);
  const values=laborProvisionDraftForEmployee(employee,'2026-10');
  expect(values).toMatchObject({included:true,assessmentMethod:'manual_daily_clt_reserve',assessmentConfirmed:false});
  expect(calculateLaborProvision(values).errors.length).toBeGreaterThan(0);
  expect(employee).toEqual(before);
  const legacy={startDate:'2026-01-01',dailyRate:120,laborProvisions:{'2026-10':stored}};
  expect(laborProvisionDraftForEmployee(legacy,'2026-10')).toEqual(stored);
});
it('usa último dia civil e salário vigente sem puxar aumento futuro para rascunho passado',()=>{
  expect(provisionReferenceDate('2026-02')).toBe('2026-02-28');
  expect(provisionReferenceDate('2028-02')).toBe('2028-02-29');
  expect(provisionReferenceDate('2026-13')).toBe('');
  const employee={startDate:'2026-01-01',remunerationMode:'clt',monthlySalary:3500,remunerationValuesHistory:[{date:'2026-01-01',monthlySalary:3000},{date:'2026-11-01',monthlySalary:3500}]};
  expect(newProvisionDraft(employee,'2026-10').base).toBe(3000);
  expect(newProvisionDraft(employee,'2026-11').base).toBe(3500);
  expect(newProvisionDraft({...dailyEmployee(),employmentRelationshipEffectiveFrom:'2026-03-01'},'2026-02').included).toBe(false);
});
