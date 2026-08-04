import {describe,expect,it} from "vitest";
import {availableRentalTransitions,normalizeRentalState,RENTAL_STATE,validateRentalTransition} from "./rental-lifecycle.js";

describe("ciclo completo da locação",()=>{
  it("normaliza estados legados sem alterar os registros",()=>{
    expect(normalizeRentalState("ativa")).toBe(RENTAL_STATE.ACTIVE);
    expect(normalizeRentalState("encerrada")).toBe(RENTAL_STATE.CLOSED);
    expect(normalizeRentalState("cancelada")).toBe(RENTAL_STATE.CANCELLED);
  });
  it("expõe somente os próximos estados permitidos",()=>{
    expect(availableRentalTransitions(RENTAL_STATE.SEPARATING)).toEqual([RENTAL_STATE.READY_FOR_DISPATCH,RENTAL_STATE.CANCELLED]);
    expect(availableRentalTransitions(RENTAL_STATE.CLOSED)).toEqual([]);
  });
  it("não entrega antes de separar nem encerra antes da inspeção",()=>{
    expect(validateRentalTransition(RENTAL_STATE.CONTRACTED,RENTAL_STATE.DELIVERED).ok).toBe(false);
    expect(validateRentalTransition(RENTAL_STATE.ACTIVE,RENTAL_STATE.CLOSED).ok).toBe(false);
    expect(validateRentalTransition(RENTAL_STATE.UNDER_INSPECTION,RENTAL_STATE.CLOSED).ok).toBe(true);
  });
  it("exige justificativa e estorno para cancelar após faturamento",()=>{
    expect(validateRentalTransition(RENTAL_STATE.QUOTED,RENTAL_STATE.CANCELLED).reason).toMatch(/justificativa/);
    expect(validateRentalTransition(RENTAL_STATE.QUOTED,RENTAL_STATE.CANCELLED,{reason:"Cliente desistiu",hasBilling:true}).reason).toMatch(/estorno/);
    expect(validateRentalTransition(RENTAL_STATE.QUOTED,RENTAL_STATE.CANCELLED,{reason:"Cliente desistiu"}).ok).toBe(true);
  });
});
