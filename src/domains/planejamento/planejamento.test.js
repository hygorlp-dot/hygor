import { describe,expect,it } from "vitest";
import { calculateCPM,calculateEarnedValue,calculatePPC,calculateProductivity,topologicalOrder } from "./calculations.js";
import { approveBaseline,reviseBaseline } from "./mutations.js";
describe("planejamento",()=>{
 it("calcula caminho crítico FS e folga",()=>{const result=calculateCPM([{id:"a",durationDays:2},{id:"b",durationDays:3},{id:"c",durationDays:1}],[{fromId:"a",toId:"b",type:"FS"},{fromId:"a",toId:"c",type:"FS"}]);expect(result.projectDuration).toBe(5);expect(result.criticalPath).toEqual(["a","b"]);expect(result.activities.find(x=>x.id==="c").totalFloat).toBe(2);});
 it("rejeita ciclos",()=>expect(()=>topologicalOrder([{id:"a"},{id:"b"}],[{fromId:"a",toId:"b"},{fromId:"b",toId:"a"}])).toThrow(/cíclica/));
 it("mantém valor agregado em centavos",()=>{const ev=calculateEarnedValue({plannedCents:10000,earnedCents:8000,actualCents:10000,budgetAtCompletionCents:20000});expect(ev.spi).toBe(.8);expect(ev.cv).toBe(-2000);expect(ev.eac).toBe(25000);});
 it("calcula PPC e causa",()=>{const ppc=calculatePPC([{status:"concluido"},{status:"nao_concluido",motivoNaoCumprimento:"material"}]);expect(ppc.ppc).toBe(.5);expect(ppc.causes[0].cause).toBe("material");});
 it("separa presença de produtividade",()=>expect(calculateProductivity({quantity:10,workerHours:20,actualCostCents:5000}).hhPerUnit).toBe(2));
 it("protege baseline aprovada e exige motivo para revisão",()=>{const approved=approveBaseline({id:"b1",status:"rascunho"},{actor:{id:"u",nome:"Ana"},now:"2026-07-26"});expect(approved.ok).toBe(true);expect(reviseBaseline(approved.baseline,{id:"b2",reason:"Aditivo"},{actor:{id:"u"},now:"2026-07-27"}).ok).toBe(true);});
});
