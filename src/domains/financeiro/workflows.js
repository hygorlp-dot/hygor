import {
  active,
  buildFinancialLedger,
  selectAccountsPayable,
  selectAccountsReceivable,
  selectCashFlow,
  selectCommitments,
  selectDRE,
  toCents,
  validateFinancialReconciliation,
} from "./ledger.js";

export const inactive = item => !active(item);
const orderTotalCents = order => (order?.itens || []).reduce((sum,item) =>
  sum + toCents(Number(item.qtd || 0) * Number(item.precoUnit || 0)),0);
const receivedTotalCents = order => (order?.itens || []).reduce((sum,item) =>
  sum + toCents(Number(item.qtdRecebida || 0) * Number(item.precoUnit || 0)),0);
const invoiceTotalCents = invoice => toCents(invoice?.valorBruto ?? invoice?.valorTotal ?? invoice?.valor);
const activeTechnicalBilling=item=>!inactive(item)
  && (item?.tipo==="medicao_tecnica"||String(item?.medicaoTecnicaId||"").length>0);

/** A receita contratada é a baseline comercial do faturamento físico. */
const resolveTechnicalBillingContract=(data={},obraId="")=>{
  const contract=(data?.comercial?.contratos||[]).find(item=>
    item?.obraId===obraId&&["contratado","assinado"].includes(String(item?.status||"").toLowerCase())&&Number(item?.valor)>0);
  if(contract)return {ok:true,source:"contrato_comercial",sourceId:contract.id,valueCents:toCents(contract.valor)};
  const work=(data?.obras||[]).find(item=>item?.id===obraId);
  if(Number(work?.contractValue)>0)return {ok:true,source:"obra",sourceId:work.id,valueCents:toCents(work.contractValue)};
  return {ok:false,error:"A obra não possui contrato comercial ou valor contratado para faturamento físico."};
};

/**
 * Conciliação de três vias: pedido contratado, recebimento físico e documento
 * fiscal. Pagamentos não participam desta conferência.
 */
export const analyzePurchaseThreeWayMatch = (data = {}, pedidoId) => {
  const order = (data.pedidos || []).find(item => item.id === pedidoId);
  if (!order) return { ok:false, status:"pedido_ausente", issues:[{code:"ORDER_NOT_FOUND",pedidoId}] };
  const invoices = (data.notasFiscais || []).filter(invoice =>
    invoice.pedidoId === pedidoId && !inactive(invoice));
  const orderedCents = orderTotalCents(order);
  const receivedCents = receivedTotalCents(order);
  const invoicedCents = invoices.reduce((sum,invoice)=>sum+invoiceTotalCents(invoice),0);
  const issues = [];
  if (receivedCents > orderedCents + 1) issues.push({
    code:"RECEIPT_EXCEEDS_ORDER",severity:"error",pedidoId,
    differenceCents:receivedCents-orderedCents,
  });
  if (invoicedCents > orderedCents + 1) issues.push({
    code:"INVOICE_EXCEEDS_ORDER",severity:"error",pedidoId,
    differenceCents:invoicedCents-orderedCents,
  });
  if (invoicedCents > receivedCents + 1) issues.push({
    code:"INVOICE_EXCEEDS_PHYSICAL_RECEIPT",severity:"warning",pedidoId,
    differenceCents:invoicedCents-receivedCents,
  });
  const closed = orderedCents > 0
    && Math.abs(orderedCents-receivedCents)<=1
    && Math.abs(orderedCents-invoicedCents)<=1;
  const status = closed ? "conciliado"
    : receivedCents<=1 && invoicedCents<=1 ? "aguardando_recebimento_e_nf"
    : receivedCents>0 && invoicedCents<=1 ? "aguardando_nf"
    : invoicedCents>receivedCents+1 ? "nf_acima_recebimento"
    : "parcial";
  return {
    ok:!issues.some(issue=>issue.severity==="error"),status,pedidoId,
    orderedCents,receivedCents,invoicedCents,
    openReceiptCents:Math.max(0,orderedCents-receivedCents),
    openInvoiceCents:Math.max(0,orderedCents-invoicedCents),
    issues,invoices:invoices.map(invoice=>invoice.id),
  };
};

/**
 * Gera a medição financeira a partir de um boletim técnico confirmado. O ID
 * técnico permanece no documento financeiro e impede faturamento duplicado.
 */
export const createBillingFromTechnicalMeasurement = (data = {}, params = {}) => {
  const technical = (data.medicoesObra || data.medicoesTecnicas || [])
    .find(item=>item.id===params.medicaoTecnicaId);
  if (!technical || inactive(technical) || !["confirmada","aprovada"].includes(String(technical.status||"confirmada").toLowerCase())) {
    return { ok:false,error:"A medição técnica precisa estar confirmada." };
  }
  if ((data.medicoes || []).some(item=>item.medicaoTecnicaId===technical.id&&!inactive(item))) {
    return { ok:false,error:"Esta medição técnica já possui faturamento." };
  }
  const contract=resolveTechnicalBillingContract(data,technical.obraId);
  if(!contract.ok)return contract;
  const cumulativeProgress=Math.max(0,Math.min(100,Number(technical.avancoFisico||0)));
  const cumulativeAmountCents=Math.round(contract.valueCents*cumulativeProgress/100);
  const alreadyBilledCents=(data.medicoes||[]).filter(item=>activeTechnicalBilling(item)&&item.obraId===technical.obraId)
    .reduce((sum,item)=>sum+toCents(item.valorPrevisto??item.valor),0);
  const amountCents=cumulativeAmountCents-alreadyBilledCents;
  if (amountCents<=0) return { ok:false,error:"O avanço aprovado já está integralmente faturado.",cumulativeAmountCents,alreadyBilledCents };
  const competence=String(params.competencia||technical.data||"").slice(0,7);
  if (!/^\d{4}-\d{2}$/.test(competence)) return { ok:false,error:"Informe uma competência válida." };
  const id=params.id||`fat-${technical.id}`;
  return {
    ok:true,
    measurement:{
      id,obraId:technical.obraId,medicaoTecnicaId:technical.id,
      competencia:competence,dataEmissao:params.dataEmissao||technical.data||`${competence}-01`,
      dataVencimento:params.dataVencimento||"",numeroParcela:params.numeroParcela||`BM ${technical.numero||""}`.trim(),
      tipo:"medicao_tecnica",valorPrevisto:amountCents/100,valorRecebido:0,
      recebido:false,recebimentos:[],status:"emitida",
      descricao:params.descricao||`Faturamento da medição técnica ${technical.numero||technical.id}`,
      snapshotTecnico:{
        medicaoId:technical.id,data:technical.data,avancoFisico:Number(technical.avancoFisico||0),
        contrato:{source:contract.source,sourceId:contract.sourceId,valueCents:contract.valueCents},
        faturamento:{cumulativeProgress,cumulativeAmountCents,alreadyBilledCents,incrementalAmountCents:amountCents},
        itens:(technical.itens||[]).map(item=>({
          tarefaId:item.tarefaId||"",nome:item.nome||"",pctConfirmado:Number(item.pctConfirmado||0),
        })),
      },
    },
  };
};

/** Vincula uma NF de terceiro à obrigação já reconhecida pela medição. */
export const linkThirdPartyInvoice = (data = {}, { medicaoTercId, notaFiscalId } = {}) => {
  const measurement=(data.medicoesTerc||[]).find(item=>item.id===medicaoTercId&&!inactive(item));
  const invoice=(data.notasFiscais||[]).find(item=>item.id===notaFiscalId&&!inactive(item));
  if(!measurement||!invoice)return {ok:false,error:"Medição ou nota fiscal não encontrada."};
  if(invoice.medicaoTercId&&invoice.medicaoTercId!==measurement.id)return {ok:false,error:"A nota já está vinculada a outra medição."};
  if(Math.abs(toCents(measurement.total)-invoiceTotalCents(invoice))>1)return {
    ok:false,error:"O valor da nota não confere com a medição.",
    differenceCents:invoiceTotalCents(invoice)-toCents(measurement.total),
  };
  return {
    ok:true,
    medicoesTerc:(data.medicoesTerc||[]).map(item=>item.id===measurement.id?{...item,notaFiscalId:invoice.id}:item),
    notasFiscais:(data.notasFiscais||[]).map(item=>item.id===invoice.id?{...item,medicaoTercId:measurement.id,obraId:item.obraId||measurement.obraId}:item),
  };
};

export const isDateInClosedPeriod = (data = {}, date = "") =>
  (data.fechamentosFinanceiros || []).some(period =>
    period.status==="fechado" && date>=period.dataInicio && date<=period.dataFim);

/**
 * Snapshot local auditável. O fechamento canônico é efetivado separadamente
 * pela RPC CLOSE_ACCOUNTING_PERIOD; este registro preserva a conferência que
 * foi apresentada ao administrador no instante do fechamento.
 */
export const createMonthlyClosingSnapshot = (data = {}, { competencia, actor = {}, closedAt = "" } = {}) => {
  if(!/^\d{4}-\d{2}$/.test(String(competencia||"")))return {ok:false,error:"Competência inválida."};
  if((data.fechamentosFinanceiros||[]).some(item=>item.competencia===competencia&&item.status==="fechado")){
    return {ok:false,error:"A competência já está fechada."};
  }
  const startDate=`${competencia}-01`;
  const endDate=new Date(Number(competencia.slice(0,4)),Number(competencia.slice(5,7)),0)
    .toISOString().slice(0,10);
  const ledger=buildFinancialLedger(data);
  const filters={startDate,endDate,competence:competencia};
  const dre=selectDRE(ledger,filters);
  const cash=selectCashFlow(ledger,{startDate,endDate});
  const receivable=selectAccountsReceivable(ledger,{asOfDate:endDate});
  const payable=selectAccountsPayable(ledger,{asOfDate:endDate});
  const commitments=selectCommitments(ledger,{asOfDate:endDate});
  const conference=validateFinancialReconciliation(ledger,filters);
  if(!conference.ok)return {ok:false,error:"Existem pendências financeiras que impedem o fechamento.",conference};
  const now=closedAt||new Date().toISOString();
  return {
    ok:true,
    closing:{
      id:`fechamento-${competencia}`,competencia,dataInicio:startDate,dataFim:endDate,
      status:"fechado",fechadoEm:now,fechadoPorId:actor.id||"",fechadoPor:actor.nome||actor.email||"",
      snapshot:{
        revenueCents:dre.revenueCents,costCents:dre.costCents,resultCents:dre.resultCents,
        cashInCents:cash.cashInCents,cashOutCents:cash.cashOutCents,cashBalanceCents:cash.balanceCents,
        receivableCents:receivable.balanceCents,payableCents:payable.balanceCents,
        commitmentCents:commitments.balanceCents,eventCount:ledger.events.length,
        eventIds:ledger.events.map(event=>event.id),
      },
      conference:{checks:conference.checks},
    },
  };
};
