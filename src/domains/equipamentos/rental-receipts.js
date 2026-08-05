import { isValidIsoDate } from "./date.js";

const text=value=>String(value||"").trim();
export const validateRentalInvoiceReceipt=(invoice={},transaction={},input={},existing=[])=>{
  if(!["issued","partially_paid"].includes(invoice.status))return {ok:false,reason:"A fatura não possui saldo recebível."};
  const transactionId=text(input.transactionId),paymentDate=text(input.paymentDate||transaction.data);
  if(!transactionId||String(transaction.id)!==transactionId)return {ok:false,reason:"Selecione uma transação bancária existente."};
  if(existing.some(item=>item.transactionId===transactionId&&item.status!=="cancelled"))return {ok:false,reason:"Esta transação bancária já foi vinculada a um recebimento."};
  const transactionAmountCents=Math.round(Number(transaction.valor||transaction.amount||0)*100);
  if(!Number.isSafeInteger(transactionAmountCents)||transactionAmountCents<=0)return {ok:false,reason:"O recebimento exige uma entrada bancária positiva."};
  if(!isValidIsoDate(paymentDate))return {ok:false,reason:"Informe uma data válida para o recebimento."};
  const amountCents=Number(input.amountCents||0);
  if(!Number.isSafeInteger(amountCents)||amountCents<=0)return {ok:false,reason:"Informe um valor de recebimento válido."};
  if(amountCents>transactionAmountCents)return {ok:false,reason:"O valor recebido não pode superar a transação bancária."};
  if(amountCents>Number(invoice.openAmountCents||0))return {ok:false,reason:"O valor recebido não pode superar o saldo aberto da fatura."};
  return {ok:true,record:{invoiceId:String(invoice.id),rentalId:String(invoice.rentalId),workId:String(invoice.workId),
    transactionId,paymentDate,amountCents,status:"confirmed",source:"bank_reconciliation",notes:text(input.notes)}};
};
