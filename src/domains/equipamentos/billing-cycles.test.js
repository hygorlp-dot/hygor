import {describe,expect,it} from "vitest";
import {calculateRentalBillingCycle} from "./billing-cycles.js";
const input={startDate:"2026-08-01",endDate:"2026-08-31",quantityMilli:1000,ratesCents:{day:10000,week:65000,fortnight:120000,month:200000}};
describe("ciclos contratuais de cobrança",()=>{
  it("preserva a melhor combinação apenas quando contratada",()=>expect(calculateRentalBillingCycle({...input,rule:"best_combination"})).toMatchObject({totalCents:210000}));
  it("cobra dias corridos e úteis explicitamente",()=>{expect(calculateRentalBillingCycle({...input,rule:"calendar_day"}).totalCents).toBe(310000);expect(calculateRentalBillingCycle({...input,rule:"business_day"}).units).toBe(21);});
  it("aplica semana, quinzena e mês de 30 dias sem otimização automática",()=>{expect(calculateRentalBillingCycle({...input,rule:"tariff_week"}).totalCents).toBe(325000);expect(calculateRentalBillingCycle({...input,rule:"tariff_fortnight"}).totalCents).toBe(360000);expect(calculateRentalBillingCycle({...input,rule:"thirty_day_month"}).totalCents).toBe(210000);});
  it("aplica mínimo contratual e hora excedente em centavos",()=>expect(calculateRentalBillingCycle({...input,endDate:"2026-08-02",rule:"calendar_day",minimumContractCents:50000,includedHoursMilli:8000,usedHoursMilli:9500,overtimeRateCents:20000})).toMatchObject({minimumAdjustmentCents:30000,overtimeCents:30000,totalCents:80000}));
});
