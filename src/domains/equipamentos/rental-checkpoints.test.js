import {describe,expect,it} from "vitest";
import {rentalReturnBalance,RENTAL_CHECKPOINT_TYPE,validateRentalCheckpoint} from "./rental-checkpoints.js";

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
    expect(validateRentalCheckpoint(rental,{type:"delivery",date:"2026-08-04",quantity:3},[{type:"dispatch"}]).reason).toMatch(/saldo da locação/);
    expect(validateRentalCheckpoint(rental,{type:"delivery",date:"2026-08-04",quantity:2,equipmentUnitIds:["u1","u3"]},[{type:"dispatch"}]).reason).toMatch(/não pertence/);
  });
  it("impede duplicidade do mesmo marco",()=>{
    expect(validateRentalCheckpoint(rental,{type:"delivery",date:"2026-08-04",quantity:2},[{type:"delivery"}]).reason).toMatch(/já foi registrado/);
  });
  it("registra devolução integral e dados de avaria",()=>{
    const returning={...rental,lifecycleState:"pickup_requested"};
    const result=validateRentalCheckpoint(returning,{type:"return",date:"2026-08-10",quantity:2,
      equipmentUnitIds:["u1","u2"],responsible:"Carlos",cleaning:"necessária",damages:["Carenagem"],missingItems:["Cabo"],needsAdjustment:true},[{type:"delivery"}]);
    expect(result.ok).toBe(true);
    expect(result.record).toMatchObject({cleaning:"necessária",damages:["Carenagem"],missingItems:["Cabo"],needsAdjustment:true});
    expect(validateRentalCheckpoint(returning,{type:"return",date:"2026-08-10",quantity:1,responsible:"Carlos"},[{type:"delivery"}]).reason).toMatch(/saldo remanescente/);
  });

  it("acumula devoluções parciais sem repetir unidade",()=>{
    const returning={...rental,lifecycleState:"pickup_requested",quantidade:3,equipmentUnitIds:["u1","u2","u3"]};
    const first=validateRentalCheckpoint(returning,{type:"partial_return",date:"2026-08-10",quantity:1,equipmentUnitIds:["u1"],responsible:"Carlos"},[]);
    expect(first.ok).toBe(true);
    const existing=[{...first.record,status:"recorded"}];
    expect(rentalReturnBalance(returning,existing)).toMatchObject({returnedQuantity:1,remainingQuantity:2,complete:false});
    expect(validateRentalCheckpoint(returning,{type:"partial_return",date:"2026-08-11",quantity:1,equipmentUnitIds:["u1"],responsible:"Carlos"},existing).reason).toMatch(/já foi devolvida/);
    const final=validateRentalCheckpoint(returning,{type:"return",date:"2026-08-11",quantity:2,equipmentUnitIds:["u2","u3"],responsible:"Carlos"},existing);
    expect(final.ok).toBe(true);
  });

  it("exige devolução anterior para iniciar inspeção",()=>{
    const inspecting={...rental,lifecycleState:"returned"};
    expect(validateRentalCheckpoint(inspecting,{type:"inspection",date:"2026-08-10",quantity:2,responsible:"Ana"}).reason).toMatch(/devolução antes/);
    expect(validateRentalCheckpoint(inspecting,{type:"inspection",date:"2026-08-10",quantity:2,equipmentUnitIds:["u1","u2"],responsible:"Ana"},[{type:"return"}]).ok).toBe(true);
  });
});
