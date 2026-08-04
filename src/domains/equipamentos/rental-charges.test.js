import {describe,expect,it} from "vitest";
import {rentalChargeSummary,validateRentalChargeItem} from "./rental-charges.js";

const base={rentalId:"r1",workId:"o1",type:"rental",description:"Locação",quantityMilli:1500,unit:"dia",unitPriceCents:3333,discountAmountCents:500,taxAmountCents:100,competence:"2026-08"};
describe("linhas de cobrança da locação",()=>{
  it("calcula integralmente em centavos",()=>expect(validateRentalChargeItem(base)).toMatchObject({ok:true,record:{grossAmountCents:5000,netAmountCents:4600}}));
  it("recusa desconto superior ao bruto",()=>expect(validateRentalChargeItem({...base,discountAmountCents:5001}).reason).toMatch(/não pode superar/));
  it("trata desconto e estorno como valores líquidos negativos",()=>expect(validateRentalChargeItem({...base,type:"reversal"}).record.netAmountCents).toBe(-4600));
  it("consolida somente linhas ativas da competência",()=>expect(rentalChargeSummary([
    {...validateRentalChargeItem(base).record,status:"open"},{...validateRentalChargeItem({...base,type:"discount"}).record,status:"open"},
    {...validateRentalChargeItem(base).record,status:"cancelled"},
  ],{competence:"2026-08"})).toMatchObject({netAmountCents:0}));
});
