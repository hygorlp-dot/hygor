// Garantia é parte do bruto da medição; não é tributo nem outro custo.
export const technicalRetentionCents=measurement=>{
 const amount=measurement?.technicalRetention?.amountCents;
 return Number.isSafeInteger(amount)&&amount>=0&&amount<=Math.round(Number(measurement?.total||0)*100)?amount:0;
};
export const thirdPartyCashAmount=payment=>payment?.technicalRetentionCents>0||payment?.guaranteePayment
 ?Number(payment.liquido??payment.amount??payment.valor??0):Number(payment?.amount||payment?.valor||payment?.liquido||0);
export const retentionInvoiceMeasurement=(data,invoice)=>(data.medicoesTerc||[]).find(m=>m.id===invoice?.medicaoTercId||m.notaFiscalId===invoice?.id);
export const RETENTION_PAYMENT_GUIDANCE='Esta medição possui garantia técnica. Registre o pagamento pela medição e concilie a baixa existente; libere a garantia separadamente.';
