import {describe,expect,it} from "vitest";
import {buildRentalPeriodicCharge,rentalChargeSummary,validateRentalChargeItem} from "./rental-charges.js";

const base={rentalId:"r1",workId:"o1",type:"rental",description:"Locação",quantityMilli:1500,unit:"dia",unitPriceCents:3333,discountAmountCents:500,taxAmountCents:100,competence:"2026-08"};
describe("linhas de cobrança da locação",()=>{
  it("calcula integralmente em centavos",()=>expect(validateRentalChargeItem(base)).toMatchObject({ok:true,record:{grossAmountCents:5000,netAmountCents:4600}}));
  it("recusa desconto superior ao bruto",()=>expect(validateRentalChargeItem({...base,discountAmountCents:5001}).reason).toMatch(/não pode superar/));
  it("trata desconto e estorno como valores líquidos negativos",()=>expect(validateRentalChargeItem({...base,type:"reversal"}).record.netAmountCents).toBe(-4600));
  it("consolida somente linhas ativas da competência",()=>expect(rentalChargeSummary([
    {...validateRentalChargeItem(base).record,status:"open"},{...validateRentalChargeItem({...base,type:"discount"}).record,status:"open"},
    {...validateRentalChargeItem(base).record,status:"cancelled"},
  ],{competence:"2026-08"})).toMatchObject({netAmountCents:0}));
  it("gera medição contratual separando utilização e competência",()=>expect(buildRentalPeriodicCharge({
    rental:{id:"r1",obraId:"o1",quantidade:2,commercialSnapshot:{regraTarifaria:"calendar_day",tarifas:{dia:100},descontoPct:10}},
    utilizationStart:"2026-08-01",utilizationEnd:"2026-08-03",competence:"2026-08",
  })).toMatchObject({ok:true,record:{grossAmountCents:60000,discountAmountCents:6000,netAmountCents:54000,status:"measured",competence:"2026-08",utilizationStart:"2026-08-01"}}));
});
