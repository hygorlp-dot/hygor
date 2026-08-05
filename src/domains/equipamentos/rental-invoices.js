import { isValidIsoDate } from "./date.js";

const text=value=>String(value||"").trim();
export const validateRentalInvoice=(input={},items=[])=>{
  const rentalId=text(input.rentalId),workId=text(input.workId),competence=text(input.competence);
  const issueDate=text(input.issueDate),dueDate=text(input.dueDate),number=text(input.number);
  if(!rentalId||!workId||!number)return {ok:false,reason:"Informe locação, obra e número da fatura."};
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence))return {ok:false,reason:"Informe uma competência válida."};
  if(!isValidIsoDate(issueDate)||!isValidIsoDate(dueDate)||dueDate<issueDate)return {ok:false,reason:"Informe datas válidas de emissão e vencimento."};
  if(!items.length)return {ok:false,reason:"Selecione ao menos uma linha para faturar."};
  if(items.some(item=>String(item.rentalId)!==rentalId||String(item.workId)!==workId||item.competence!==competence))return {ok:false,reason:"Todas as linhas devem pertencer à mesma locação, obra e competência."};
  if(items.some(item=>!["open","measured"].includes(item.status)))return {ok:false,reason:"Somente linhas abertas ou medidas podem ser faturadas."};
  const grossAmountCents=items.reduce((sum,item)=>sum+Number(item.grossAmountCents||0),0);
  const discountAmountCents=items.reduce((sum,item)=>sum+Number(item.discountAmountCents||0),0);
  const taxAmountCents=items.reduce((sum,item)=>sum+Number(item.taxAmountCents||0),0);
  const netAmountCents=items.reduce((sum,item)=>sum+Number(item.netAmountCents||0),0);
  if(!Number.isSafeInteger(netAmountCents)||netAmountCents<=0)return {ok:false,reason:"O valor líquido da fatura deve ser positivo."};
  return {ok:true,record:{rentalId,workId,competence,number,issueDate,dueDate,grossAmountCents,
    discountAmountCents,taxAmountCents,netAmountCents,status:"issued",receivedAmountCents:0,openAmountCents:netAmountCents}};
};
