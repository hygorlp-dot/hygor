import {describe,expect,it} from "vitest";
import {validateRentalReplacement} from "./rental-replacements.js";

const rental={equipmentUnitIds:["u1"],lifecycleState:"active"},units=[{id:"u1"},{id:"u2"}];
describe("substituição de unidade da locação",()=>{
  it("exige unidade diferente, data e motivo",()=>{
    expect(validateRentalReplacement(rental,{outgoingUnitId:"u1",incomingUnitId:"u2",date:"2026-08-04",reason:"Avaria"},units).ok).toBe(true);
    expect(validateRentalReplacement(rental,{outgoingUnitId:"u1",incomingUnitId:"u1",date:"2026-08-04",reason:"Avaria"},units).ok).toBe(false);
    expect(validateRentalReplacement(rental,{outgoingUnitId:"u1",incomingUnitId:"u2",date:"2026-08-04"},units).reason).toMatch(/motivo/);
  });
  it("recusa após devolução",()=>expect(validateRentalReplacement({...rental,lifecycleState:"returned"},{},units).ok).toBe(false));
});
