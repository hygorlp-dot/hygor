import {expect,it} from "vitest";
import {calculateLaborProvision,newProvisionDraft,summarizeLaborProvisions} from "./labor-provisions.js";
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
