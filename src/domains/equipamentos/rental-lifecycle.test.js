import {describe,expect,it} from "vitest";
import {availableRentalTransitions,normalizeRentalState,rentalStateLabel,RENTAL_STATE,validateRentalClosure,validateRentalTransition} from "./rental-lifecycle.js";

describe("ciclo completo da locação",()=>{
  it("normaliza estados legados sem alterar os registros",()=>{
    expect(normalizeRentalState("ativa")).toBe(RENTAL_STATE.ACTIVE);
    expect(normalizeRentalState("encerrada")).toBe(RENTAL_STATE.CLOSED);
    expect(normalizeRentalState("cancelada")).toBe(RENTAL_STATE.CANCELLED);
  });
  it("expõe somente os próximos estados permitidos",()=>{
    expect(availableRentalTransitions(RENTAL_STATE.SEPARATING)).toEqual([RENTAL_STATE.READY_FOR_DISPATCH,RENTAL_STATE.CANCELLED]);
    expect(availableRentalTransitions(RENTAL_STATE.CLOSED)).toEqual([]);
    expect(rentalStateLabel(RENTAL_STATE.PICKUP_REQUESTED)).toBe("Retirada solicitada");
  });
  it("não entrega antes de separar nem encerra antes da inspeção",()=>{
    expect(validateRentalTransition(RENTAL_STATE.CONTRACTED,RENTAL_STATE.DELIVERED).ok).toBe(false);
    expect(validateRentalTransition(RENTAL_STATE.ACTIVE,RENTAL_STATE.CLOSED).ok).toBe(false);
    expect(validateRentalTransition(RENTAL_STATE.UNDER_INSPECTION,RENTAL_STATE.CLOSED).ok).toBe(true);
  });
  it("exige o checklist correspondente nos marcos logísticos",()=>{
    expect(validateRentalTransition("separating","ready_for_dispatch").reason).toMatch(/checklist de separation/);
    expect(validateRentalTransition("separating","ready_for_dispatch",{checkpoints:[{type:"separation"}]}).ok).toBe(true);
    expect(validateRentalTransition("in_transport","delivered",{checkpoints:[{type:"delivery",quantity:1}]}).ok).toBe(true);
    expect(validateRentalTransition("pickup_requested","returned").reason).toMatch(/checklist de return/);
    expect(validateRentalTransition("pickup_requested","returned",{checkpoints:[{type:"return",quantity:1}],rentalQuantity:1}).ok).toBe(true);
    expect(validateRentalTransition("pickup_requested","returned",{checkpoints:[{type:"partial_return",quantity:1},{type:"return",quantity:1}],rentalQuantity:3}).reason).toMatch(/pendentes/);
    expect(validateRentalTransition("returned","under_inspection",{checkpoints:[{type:"inspection"}]}).ok).toBe(true);
  });
  it("não avança enquanto a expedição ou entrega parcial tiver saldo",()=>{
    expect(validateRentalTransition("ready_for_dispatch","in_transport",{checkpoints:[
      {type:"partial_dispatch",quantity:1},{type:"dispatch",quantity:1},
    ],rentalQuantity:3}).reason).toMatch(/pendentes de movimentação/);
    expect(validateRentalTransition("ready_for_dispatch","in_transport",{checkpoints:[
      {type:"partial_dispatch",quantity:1},{type:"dispatch",quantity:2},
    ],rentalQuantity:3}).ok).toBe(true);
    expect(validateRentalTransition("in_transport","delivered",{checkpoints:[
      {type:"partial_delivery",quantity:1},{type:"delivery",quantity:2},
    ],rentalQuantity:3}).ok).toBe(true);
  });
  it("exige justificativa e estorno para cancelar após faturamento",()=>{
    expect(validateRentalTransition(RENTAL_STATE.QUOTED,RENTAL_STATE.CANCELLED).reason).toMatch(/justificativa/);
    expect(validateRentalTransition(RENTAL_STATE.QUOTED,RENTAL_STATE.CANCELLED,{reason:"Cliente desistiu",hasBilling:true}).reason).toMatch(/estorno/);
    expect(validateRentalTransition(RENTAL_STATE.QUOTED,RENTAL_STATE.CANCELLED,{reason:"Cliente desistiu"}).ok).toBe(true);
  });
  it("usa o resultado da inspeção para decidir ajuste ou encerramento",()=>{
    const clear=[{type:"inspection",needsAdjustment:false}],damaged=[{type:"inspection",needsAdjustment:true}];
    expect(availableRentalTransitions("under_inspection",{checkpoints:clear})).toEqual(["closed"]);
    expect(availableRentalTransitions("under_inspection",{checkpoints:damaged})).toEqual(["awaiting_adjustment"]);
    expect(validateRentalTransition("under_inspection","closed",{checkpoints:damaged}).reason).toMatch(/Resolva os ajustes/);
  });
  it("bloqueia encerramento novo antes da inspeção e preserva legado",()=>{
    expect(validateRentalClosure({status:"ativa"})).toMatchObject({ok:true,legacy:true});
    expect(validateRentalClosure({status:"ativa",lifecycleState:"active"}).reason).toMatch(/após devolução e inspeção/);
    expect(validateRentalClosure({lifecycleState:"under_inspection",rentalCheckpoints:[{type:"inspection",needsAdjustment:false}]}).ok).toBe(true);
    expect(validateRentalClosure({lifecycleState:"awaiting_adjustment",rentalCheckpoints:[{type:"inspection",needsAdjustment:true}]}).reason).toMatch(/conclusão do ajuste/);
    expect(validateRentalClosure({lifecycleState:"awaiting_adjustment",rentalCheckpoints:[{type:"inspection",needsAdjustment:true},{type:"adjustment"}]}).ok).toBe(true);
  });
});
