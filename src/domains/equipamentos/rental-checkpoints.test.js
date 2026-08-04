import {describe,expect,it} from "vitest";
import {RENTAL_CHECKPOINT_TYPE,validateRentalCheckpoint} from "./rental-checkpoints.js";

const rental={id:"r1",quantidade:2,equipmentUnitIds:["u1","u2"],lifecycleState:"in_transport"};

describe("checklists do ciclo da locação",()=>{
  it("valida entrega com identidade, responsável e endereço",()=>{
    const result=validateRentalCheckpoint(rental,{type:RENTAL_CHECKPOINT_TYPE.DELIVERY,date:"2026-08-04",quantity:2,
      equipmentUnitIds:["u1","u2"],responsible:"João",receivedBy:"Maria",address:"Obra A",hourMeter:120},[{type:"dispatch"}]);
    expect(result.ok).toBe(true);
    expect(result.record).toMatchObject({quantity:2,hourMeter:120,receivedBy:"Maria"});
  });
  it("recusa estado, quantidade e unidade física inconsistentes",()=>{
    expect(validateRentalCheckpoint({...rental,lifecycleState:"active"},{type:"delivery",date:"2026-08-04",quantity:2}).reason).toMatch(/estado active/);
    expect(validateRentalCheckpoint(rental,{type:"delivery",date:"2026-08-04",quantity:3},[{type:"dispatch"}]).reason).toMatch(/quantidade contratada/);
    expect(validateRentalCheckpoint(rental,{type:"delivery",date:"2026-08-04",quantity:2,equipmentUnitIds:["u1","u3"]},[{type:"dispatch"}]).reason).toMatch(/não pertence/);
  });
  it("impede duplicidade do mesmo marco",()=>{
    expect(validateRentalCheckpoint(rental,{type:"delivery",date:"2026-08-04",quantity:2},[{type:"delivery"}]).reason).toMatch(/já foi registrado/);
  });
});
