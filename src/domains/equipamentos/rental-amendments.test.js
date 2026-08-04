import {describe,expect,it} from "vitest";
import {RENTAL_AMENDMENT_TYPE,validateRentalAmendment} from "./rental-amendments.js";

const rental={id:"r1",inicio:"2026-08-01",plannedEndDate:"2026-08-31",lifecycleState:"active"};

describe("aditivos de prazo da locação",()=>{
  it("prorroga somente para uma data posterior",()=>{
    expect(validateRentalAmendment(rental,{type:RENTAL_AMENDMENT_TYPE.EXTENSION,newEndDate:"2026-09-15"}))
      .toMatchObject({ok:true,record:{newEndDate:"2026-09-15"}});
    expect(validateRentalAmendment(rental,{type:"extension",newEndDate:"2026-08-20"}).reason).toMatch(/posterior/);
  });
  it("renova sem sobrepor o período vigente ou outro aditivo",()=>{
    expect(validateRentalAmendment(rental,{type:"renewal",startDate:"2026-09-01",endDate:"2026-09-30"}).ok).toBe(true);
    expect(validateRentalAmendment(rental,{type:"renewal",startDate:"2026-08-20",endDate:"2026-09-20"}).reason).toMatch(/após o término/);
    const renewed={...rental,renewalPeriods:[{startDate:"2026-09-01",endDate:"2026-09-30"}],plannedEndDate:"2026-08-31"};
    expect(validateRentalAmendment(renewed,{type:"renewal",startDate:"2026-09-15",endDate:"2026-10-15"}).reason).toMatch(/conflita/);
  });
  it("recusa alteração após devolução",()=>{
    expect(validateRentalAmendment({...rental,lifecycleState:"returned"},{type:"extension",newEndDate:"2026-09-15"}).ok).toBe(false);
  });
});
