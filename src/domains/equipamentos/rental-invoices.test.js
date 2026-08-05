import {describe,expect,it} from "vitest";
import {validateRentalInvoice} from "./rental-invoices.js";
const input={rentalId:"r1",workId:"o1",competence:"2026-08",number:"FAT-1",issueDate:"2026-08-31",dueDate:"2026-09-10"};
const items=[{rentalId:"r1",workId:"o1",competence:"2026-08",status:"measured",grossAmountCents:10000,discountAmountCents:1000,taxAmountCents:0,netAmountCents:9000}];
describe("fatura de locação",()=>{
  it("consolida linhas elegíveis em centavos",()=>expect(validateRentalInvoice(input,items)).toMatchObject({ok:true,record:{netAmountCents:9000,openAmountCents:9000,status:"issued"}}));
  it("recusa vencimento anterior e mistura de competência",()=>{expect(validateRentalInvoice({...input,dueDate:"2026-08-30"},items).ok).toBe(false);expect(validateRentalInvoice(input,[{...items[0],competence:"2026-07"}]).ok).toBe(false);});
  it("recusa linha já faturada",()=>expect(validateRentalInvoice(input,[{...items[0],status:"billed"}]).reason).toMatch(/abertas ou medidas/));
});
