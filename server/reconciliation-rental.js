import {applyEquipmentCommand,EQUIPMENT_COMMAND} from '../src/domains/equipamentos/commands.js';
import {active} from '../src/domains/financeiro/facts.js';
import {buildFinancialLedger} from '../src/domains/financeiro/ledger.js';
import {isFinancialDate} from '../src/domains/financeiro/dates.js';
import {isDateInClosedPeriod,isCompetenceInClosedPeriod} from '../src/domains/financeiro/workflows.js';

export function confirmRentalReceipt(data,transaction,payload,actor,key){
  const fail=motivo=>({data,resumo:{ok:false,motivo}}),invoice=(data.rentalInvoices||[]).find(row=>row.id===payload.invoiceId);
  if(!invoice||invoice.status==='cancelled')return fail('Selecione uma fatura de locação disponível nesta empresa.');
  const rental=(data.locacoesEquip||[]).find(row=>String(row.id)===String(invoice.rentalId));
  if(!rental||!active(rental)||['cancelada','cancelled'].includes(rental.status))return fail('A locação da fatura está indisponível.');
  if(String(rental.obraId||rental.workId||'')!==String(invoice.workId||'')||!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(invoice.competence||'')))return fail('Confira a obra e a competência da fatura na origem.');
  if(invoice.workId&&!(data.obras||[]).some(work=>work.id===invoice.workId))return fail('A obra da fatura não pertence a esta empresa.');
  if(payload.expectedInvoiceVersion!==Number(invoice.version||0))return fail('A fatura mudou. Atualize e revise seu saldo.');
  if(isDateInClosedPeriod(data,transaction.data)||isCompetenceInClosedPeriod(data,invoice.competence))return fail('O período bancário ou a competência da locação está fechado.');
  const amountCents=Math.round(Number(transaction.valor)*100);
  if(!isFinancialDate(transaction.data)||!Number.isFinite(Number(transaction.valor))||Math.abs(Number(transaction.valor)*100-amountCents)>0.000001)return fail('Confira a data e os centavos do movimento bancário.');
  if(buildFinancialLedger(data).events.some(event=>event.transactionId===transaction.id&&['cash_in','cash_out'].includes(event.effect)))return fail('O movimento já representa um recebimento ou pagamento existente. Revise o vínculo no DRE.');
  if(!Number.isSafeInteger(amountCents)||amountCents<=0)return fail('Selecione uma entrada bancária válida.');
  const existing=(data.rentalInvoiceReceipts||[]).filter(row=>row.transactionId===transaction.id&&row.status!=='cancelled');
  if(existing.length>1)return fail('Há mais de um recebimento de locação para este movimento. Confira a origem.');
  let next=data,receipt=existing[0];
  if(receipt&&(receipt.invoiceId!==invoice.id||receipt.amountCents!==amountCents||receipt.paymentDate!==transaction.data))return fail('O recebimento existente diverge do movimento bancário. Confira valor, data e fatura.');
  if(!receipt){
    const result=applyEquipmentCommand(data,{type:EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED,expectedVersion:invoice.version||0,
      idempotencyKey:key,actorId:actor.id,payload:{invoiceId:invoice.id,receipt:{transactionId:transaction.id,paymentDate:transaction.data,amountCents}}});
    if(!result.ok)return fail(result.reason);
    next=result.data;receipt=next.rentalInvoiceReceipts.find(row=>row.id===result.entityId);
  }
  if((next.payments||[]).some(row=>active(row)&&(row.transacaoId===transaction.id||row.rentalReceiptId===receipt.id)))return fail('Este recebimento já possui lançamento financeiro. Confira o vínculo existente.');
  const payment={id:`rental_bank_${receipt.id}`,amount:amountCents/100,date:transaction.data,obraId:'',categoria:'receita_locacoes',
    competencia:invoice.competence||transaction.data.slice(0,7),description:`Recebimento da locação · fatura ${invoice.number||invoice.id}`,
    rentalInvoiceId:invoice.id,rentalReceiptId:receipt.id,locacaoId:invoice.rentalId,
    efeitoDRE:'vinculado',origem:'conciliacao_locacao',transacaoId:transaction.id,conciliado:true,registradoPorId:actor.id,registradoEm:new Date().toISOString()};
  return {data:{...next,payments:[...(next.payments||[]),payment],transacoes:next.transacoes.map(row=>row.id!==transaction.id?row:{...row,
    status:'conciliado',vinculo:{tipo:'rentalInvoice',id:invoice.id,receiptId:receipt.id,paymentId:payment.id,receiptCreated:!existing.length},
    gerados:[{tipo:'payments',id:payment.id,entidadeId:payment.id}],valorVinculado:amountCents/100,saldoNaoVinculado:0,
    rateios:[{destino:'empresa',obraId:'',categoria:'receita_locacoes',valor:amountCents/100,competencia:invoice.competence||transaction.data.slice(0,7)}]}),
    historicoConc:[...(next.historicoConc||[]),{id:`rental_${receipt.id}`,criadoEm:new Date().toISOString(),transacaoId:transaction.id,acao:'recebimento_locacao_vinculado',
      descricao:'Recebimento vinculado à fatura existente, sem novo faturamento',valor:transaction.valor,operadorId:actor.id,statusNovo:'conciliado'}]},
    resumo:{ok:true,vinculo:{tipo:'rentalInvoice',id:invoice.id},criados:[{tipo:'payments',id:payment.id}]}};
}
