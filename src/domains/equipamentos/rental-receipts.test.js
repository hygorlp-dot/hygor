import {describe,expect,it} from "vitest";
import {validateRentalInvoiceReceipt} from "./rental-receipts.js";
const invoice={id:"i1",rentalId:"r1",workId:"o1",status:"issued",openAmountCents:10000},transaction={id:"t1",data:"2026-09-10",valor:80};
describe("recebimento conciliado de fatura",()=>{
  it("aceita recebimento parcial respaldado por entrada bancária",()=>expect(validateRentalInvoiceReceipt(invoice,transaction,{transactionId:"t1",amountCents:8000},[])).toMatchObject({ok:true,record:{amountCents:8000,source:"bank_reconciliation"}}));
  it("recusa saída, excesso e reutilização da transação",()=>{expect(validateRentalInvoiceReceipt(invoice,{...transaction,valor:-80},{transactionId:"t1",amountCents:8000},[]).ok).toBe(false);expect(validateRentalInvoiceReceipt(invoice,transaction,{transactionId:"t1",amountCents:10001},[]).ok).toBe(false);expect(validateRentalInvoiceReceipt(invoice,transaction,{transactionId:"t1",amountCents:8000},[{transactionId:"t1",status:"confirmed"}]).reason).toMatch(/já foi vinculada/);});
});
