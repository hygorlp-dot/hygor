/**
 * Razão gerencial derivado. Não é persistido: os fatos continuam em seus
 * módulos de origem e são convertidos aqui em efeitos financeiros canônicos.
 */

import { companyExpenseCategory } from "../dre/expense-taxonomy.js";

export const toCents = value => Math.round(Number(value || 0) * 100);
export const fromCents = value => Number(value || 0) / 100;

// Arquivamento só muda a organização da interface: jamais anula um fato
// econômico. Cancelamento, rejeição e estorno, por sua vez, são estados sem
// efeito na projeção derivada. A normalização evita que acentos ou a variante
// inglesa alterem o resultado financeiro.
const INACTIVE = new Set([
  "cancelado", "cancelada", "cancelled", "canceled",
  "rejeitado", "rejeitada", "rejected",
  "rascunho", "draft",
  "estornado", "estornada", "reversed", "reverted",
  "excluido", "excluida", "deleted",
]);
const RECOGNIZABLE_INVOICE = new Set(["recebida", "aprovada", "paga", "conferida", "reconhecida"]);
const APPROVED_ORDER = new Set(["aprovado", "aprovada", "emitido", "emitida", "comprado", "recebido", "entregue", "pago", "parcial", "arquivado", "arquivada", "archived"]);
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10))
  ? String(value).slice(0, 10) : "";
const competenceOf = value => /^\d{4}-\d{2}$/.test(String(value || "").slice(0, 7))
  ? String(value).slice(0, 7) : "";
const statusOf = item => String(item?.status || "").trim()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const active = item => item?.deletedAt == null && item?.ativo !== false && !INACTIVE.has(statusOf(item));
const positiveCents = (...values) => {
  for (const value of values) {
    const cents = toCents(value);
    if (cents > 0) return cents;
  }
  return 0;
};
const stableToken = value => {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};
const sourceId = (item, fallback) => String(item?.id || stableToken(fallback));
const sumOrder = order => {
  const explicit = positiveCents(order?.valorTotal, order?.total, order?.valor);
  if (explicit) return explicit;
  return (order?.itens || []).reduce((sum, item) =>
    sum + toCents(Number(item.quantidade || item.qtd || 0) * Number(item.precoUnit || item.preco || item.valorUnitario || 0)), 0);
};
const invoiceAmount = invoice => positiveCents(invoice?.valorBruto, invoice?.valorTotal, invoice?.total, invoice?.valor);
const thirdMeasurementAmount = measurement => positiveCents(measurement?.total, measurement?.valor, measurement?.valorPrevisto, measurement?.valorBruto);

export const notaReconhecivel = invoice => {
  if (!active(invoice)) return false;
  const status = statusOf(invoice);
  return !status || RECOGNIZABLE_INVOICE.has(status);
};

export const recebimentosDaMedicao = measurement => {
  const explicit = Array.isArray(measurement?.recebimentos)
    ? measurement.recebimentos.filter(active) : [];
  if (explicit.length) return explicit.map(receipt => ({ ...receipt, legacy: false }));
  const amount = positiveCents(measurement?.valorRecebido);
  if (!amount) return [];
  return [{
    id: `legacy-${sourceId(measurement, `${measurement?.obraId}|${measurement?.competencia}`)}`,
    valor: fromCents(amount),
    data: measurement?.dataPagamento || "",
    origem: "legado",
    transacaoId: measurement?.transacaoId || "",
    legacy: true,
  }];
};

const totalReceiptsCents = measurement =>
  recebimentosDaMedicao(measurement).reduce((sum, receipt) => sum + positiveCents(receipt.valor, receipt.amount), 0);

const measurementCompetence = measurement =>
  competenceOf(measurement?.competencia)
  || competenceOf(measurement?.dataEmissao)
  || competenceOf(measurement?.emissao)
  || competenceOf(measurement?.dataVencimento)
  || competenceOf(measurement?.vencimento);

const measurementDate = measurement =>
  isoDate(measurement?.dataEmissao)
  || isoDate(measurement?.emissao)
  || isoDate(measurement?.dataVencimento)
  || isoDate(measurement?.vencimento)
  || (measurementCompetence(measurement) ? `${measurementCompetence(measurement)}-01` : "");

const invoiceDate = invoice =>
  isoDate(invoice?.emissao) || isoDate(invoice?.dataEmissao)
  || isoDate(invoice?.vencimento) || isoDate(invoice?.dataVencimento)
  || (competenceOf(invoice?.competencia) ? `${competenceOf(invoice.competencia)}-01` : "");

const allocationRows = invoice => {
  if (!Array.isArray(invoice?.rateios) || !invoice.rateios.length) {
    return [{ id: "principal", obraId: invoice?.obraId || "", amountCents: invoiceAmount(invoice) }];
  }
  return invoice.rateios.filter(active).map(rateio => ({
    id: sourceId(rateio, `${rateio.obraId}|${rateio.etapaId}|${rateio.valor}|${rateio.percentual}`),
    obraId: rateio.obraId || invoice?.obraId || "",
    amountCents: positiveCents(rateio.valor)
      || Math.round(invoiceAmount(invoice) * Number(rateio.percentual || 0) / 100),
  })).filter(row => row.amountCents > 0);
};

const eventMatches = (event, filters = {}, mode = "date") => {
  if (filters.obraId && event.obraId !== filters.obraId) return false;
  if (!filters.includeCorporate && filters.obraId && !event.obraId) return false;
  const date = mode === "competence" ? event.competence : event.date;
  if (filters.competence && event.competence !== filters.competence) return false;
  if (filters.startDate && (!date || date < filters.startDate.slice(0, mode === "competence" ? 7 : 10))) return false;
  if (filters.endDate && (!date || date > filters.endDate.slice(0, mode === "competence" ? 7 : 10))) return false;
  if (filters.asOfDate && event.date && event.date > filters.asOfDate) return false;
  return true;
};

/** Converte os fatos legados em eventos determinísticos, em centavos. */
export const buildFinancialLedger = (data = {}, options = {}) => {
  const events = [];
  const issues = [];
  const eventIds = new Set();
  const cashTransactions = new Map();
  const cashLinks = new Map();
  const obras = new Map((data.obras || []).map(item => [item.id, item]));
  const fornecedores = new Map((data.fornecedores || []).map(item => [item.id, item]));
  const transactions = new Map((data.transacoes || []).map(item => [item.id, item]));
  const invoicesByOrder = new Map();
  const thirdPaymentsByMeasurement = new Map();
  const thirdMeasurementByInvoice = new Map();
  const invoicePaymentIds = new Set();
  const invoicePaymentTransactions = new Set();

  (data.notasFiscais || []).forEach(invoice => {
    if (invoice.pedidoId) {
      const list = invoicesByOrder.get(invoice.pedidoId) || [];
      list.push(invoice); invoicesByOrder.set(invoice.pedidoId, list);
    }
    if (invoice.medicaoTercId) thirdMeasurementByInvoice.set(invoice.id, invoice.medicaoTercId);
    (invoice.pagamentos || []).forEach(payment => {
      if (payment.id) invoicePaymentIds.add(payment.id);
      if (payment.transacaoId) invoicePaymentTransactions.add(payment.transacaoId);
    });
  });
  (data.medicoesTerc || []).forEach(measurement => {
    if (measurement.notaFiscalId) thirdMeasurementByInvoice.set(measurement.notaFiscalId, measurement.id);
  });
  (data.pagsTerceiros || []).forEach(payment => {
    const measurementId = payment.medicaoTercId || payment.medicaoId || "";
    if (!measurementId) return;
    const list = thirdPaymentsByMeasurement.get(measurementId) || [];
    list.push(payment); thirdPaymentsByMeasurement.set(measurementId, list);
  });

  const issue = (code, sourceType, item, description, extra = {}) => issues.push({
    code, severity: extra.severity || "warning", sourceType,
    sourceId: sourceId(item, `${sourceType}|${description}`),
    obraId: item?.obraId || extra.obraId || "", description, ...extra,
  });

  const add = raw => {
    const amountCents = Math.abs(Math.round(Number(raw.amountCents || 0)));
    if (!(amountCents > 0) || !Number.isFinite(amountCents)) {
      issue("INVALID_AMOUNT", raw.sourceType, { id: raw.sourceId, obraId: raw.obraId }, "Valor financeiro inválido.", { severity: "error" });
      return;
    }
    const event = {
      id: raw.id, effect: raw.effect, amountCents,
      date: isoDate(raw.date), competence: competenceOf(raw.competence || raw.date),
      obraId: raw.obraId || "", category: raw.category || "outros",
      description: raw.description || "", counterparty: raw.counterparty || "",
      sourceType: raw.sourceType, sourceId: String(raw.sourceId || ""),
      sourceSubId: String(raw.sourceSubId || ""), documentNumber: raw.documentNumber || "",
      settlesSourceType: raw.settlesSourceType || "", settlesSourceId: raw.settlesSourceId || "",
      transactionId: raw.transactionId || "", status: raw.status || "recognized",
      legacy: !!raw.legacy, unallocated: !!raw.unallocated, metadata: raw.metadata || {},
    };
    if (!event.id || eventIds.has(event.id)) {
      issue("DUPLICATE_EVENT_ID", event.sourceType, { id: event.sourceId, obraId: event.obraId }, `ID financeiro duplicado: ${event.id || "(vazio)"}`, { severity: "error" });
      return;
    }
    if (!event.date) issue("INVALID_DATE", event.sourceType, { id: event.sourceId, obraId: event.obraId }, "Documento sem data financeira válida.");
    if (event.transactionId && ["cash_in", "cash_out"].includes(event.effect)) {
      const key = `${event.effect}|${event.transactionId}|${event.amountCents}`;
      if (cashTransactions.has(key)) {
        issue("DUPLICATE_TRANSACTION_EFFECT", event.sourceType, { id: event.sourceId, obraId: event.obraId },
          `A transação ${event.transactionId} já produziu o mesmo efeito de caixa.`, {
            transactionId: event.transactionId, duplicateOf: cashTransactions.get(key),
          });
        return;
      }
      cashTransactions.set(key, event.id);
    }
    if (event.sourceSubId && ["cash_in", "cash_out"].includes(event.effect)) {
      const key = `${event.effect}|${event.sourceSubId}|${event.amountCents}`;
      if (cashLinks.has(key)) {
        issue("DUPLICATE_TRANSACTION_EFFECT", event.sourceType, { id: event.sourceId, obraId: event.obraId },
          `O pagamento/recebimento ${event.sourceSubId} já produziu efeito de caixa.`, {
            duplicateOf: cashLinks.get(key),
          });
        return;
      }
      cashLinks.set(key, event.id);
    }
    eventIds.add(event.id); events.push(event);
  };

  (data.medicoes || []).filter(active).forEach(measurement => {
    const id = sourceId(measurement, `${measurement.obraId}|${measurement.competencia}|${measurement.valorPrevisto}`);
    const amountCents = positiveCents(measurement.valorPrevisto, measurement.valor);
    const date = measurementDate(measurement);
    const competence = measurementCompetence(measurement);
    const base = {
      amountCents, date, competence, obraId: measurement.obraId || "", category: "faturamento",
      description: measurement.descricao || `Medição ${measurement.numeroParcela || measurement.numero || ""}`.trim(),
      counterparty: obras.get(measurement.obraId)?.cliente || "Cliente",
      sourceType: "medicao", sourceId: id, documentNumber: measurement.numeroParcela || measurement.numero || "",
      metadata: { dueDate:isoDate(measurement.dataVencimento || measurement.vencimento) },
    };
    add({ ...base, id: `medicao:${id}:revenue`, effect: "revenue" });
    add({ ...base, id: `medicao:${id}:receivable`, effect: "receivable_increase" });
    recebimentosDaMedicao(measurement).forEach(receipt => {
      const receiptId = sourceId(receipt, `${id}|${receipt.data}|${receipt.valor}|${receipt.transacaoId}`);
      const receiptBase = {
        ...base, amountCents: positiveCents(receipt.valor, receipt.amount),
        date: receipt.data || measurement.dataPagamento, sourceSubId: receiptId,
        transactionId: receipt.transacaoId || "", legacy: !!receipt.legacy,
        metadata: { origem: receipt.origem || "", measurementStatus: measurement.recebido ? "recebido" : "aberto" },
      };
      add({ ...receiptBase, id: `medicao:${id}:receipt:${receiptId}:cash`, effect: "cash_in" });
      add({ ...receiptBase, id: `medicao:${id}:receipt:${receiptId}:settle`, effect: "receivable_decrease", settlesSourceType: "medicao", settlesSourceId: id });
      if (receipt.legacy) issue("LEGACY_MEASUREMENT_RECEIPT", "medicao", measurement, "Recebimento reconstruído do campo espelho legado.", { severity: "info" });
    });
  });

  const recebimentosAvulsos = data.payments || [];
  recebimentosAvulsos.filter(active).forEach(receipt => {
    const id = sourceId(receipt, `${receipt.obraId}|${receipt.date}|${receipt.amount}|${receipt.description}`);
    const linked = receipt.medicaoId || receipt.contratoId || "";
    const base = {
      amountCents: positiveCents(receipt.amount, receipt.valor), date: receipt.date || receipt.data,
      obraId: receipt.obraId || "", category: "recebimento_avulso",
      description: receipt.description || receipt.descricao || "Recebimento avulso",
      sourceType: "recebimento_avulso", sourceId: id, transactionId: receipt.transacaoId || "",
      unallocated: !linked, metadata: { origem: receipt.origem || "manual", conciliado: !!receipt.conciliado },
    };
    add({ ...base, id: `recebimento_avulso:${id}:cash`, effect: "cash_in" });
    if (receipt.medicaoId) add({ ...base, id: `recebimento_avulso:${id}:settle`, effect: "receivable_decrease", settlesSourceType: "medicao", settlesSourceId: receipt.medicaoId });
    if (!linked) issue("RECEIPT_UNALLOCATED", "recebimento_avulso", receipt, "Recebimento sem vínculo com medição ou contrato.", { severity: "info" });
  });

  (data.pedidos || []).filter(active).forEach(order => {
    const status = statusOf(order);
    if (status && !APPROVED_ORDER.has(status)) return;
    const id = sourceId(order, `${order.obraId}|${order.numero}|${order.data}`);
    const totalCents = sumOrder(order);
    if (!order.obraId) issue("ORDER_WITHOUT_PROJECT", "pedido", order, "Pedido aprovado sem obra.");
    const base = {
      amountCents: totalCents, date: order.data || order.emissao,
      competence: competenceOf(order.competencia || order.data), obraId: order.obraId || "",
      category: "compras", description: `Pedido ${order.numero || id}`,
      counterparty: fornecedores.get(order.fornecedorId)?.nome || order.fornecedorNome || "",
      sourceType: "pedido", sourceId: id, documentNumber: order.numero || "",
    };
    add({ ...base, id: `pedido:${id}:commitment`, effect: "commitment_increase" });
    const recognized = (invoicesByOrder.get(order.id) || []).filter(notaReconhecivel)
      .reduce((sum, invoice) => sum + invoiceAmount(invoice), 0);
    if (recognized > 0) add({ ...base, id: `pedido:${id}:recognized`, effect: "commitment_decrease", amountCents: Math.min(totalCents, recognized), metadata: { recognizedInvoiceCents: recognized } });
    (order.pagamentos || []).filter(active).forEach(payment => {
      if ((payment.id && invoicePaymentIds.has(payment.id))
        || (payment.transacaoId && invoicePaymentTransactions.has(payment.transacaoId))) return;
      const paymentId = sourceId(payment, `${id}|${payment.data}|${payment.valor}|${payment.transacaoId}`);
      add({
        ...base, id: `pedido:${id}:payment:${paymentId}:cash`, effect: "cash_out",
        amountCents: positiveCents(payment.valor, payment.amount), date: payment.data,
        sourceSubId: paymentId, transactionId: payment.transacaoId || "",
        unallocated: true,
        metadata: {
          obligationMissing:true, conciliado:!!payment.conciliado,
          origem:payment.origem || order.origemPagamento || "",
        },
      });
      issue("PAYMENT_UNALLOCATED", "pedido", order, "Pagamento de pedido sem documento de competência vinculado.", { severity: "info" });
    });
  });

  (data.notasFiscais || []).filter(notaReconhecivel).forEach(invoice => {
    const id = sourceId(invoice, `${invoice.obraId}|${invoice.numero}|${invoice.valorBruto}`);
    const amountCents = invoiceAmount(invoice);
    const date = invoiceDate(invoice);
    const competence = competenceOf(invoice.competencia) || competenceOf(date);
    const allocations = allocationRows(invoice);
    const allocatedCents = allocations.reduce((sum, row) => sum + row.amountCents, 0);
    const linkedThirdMeasurementId = thirdMeasurementByInvoice.get(invoice.id) || "";
    const linkedThirdMeasurement = linkedThirdMeasurementId
      ? (data.medicoesTerc || []).find(item => item.id === linkedThirdMeasurementId)
      : null;
    if (!invoice.obraId && !invoice.rateios?.length) {
      issue("NF_WITHOUT_PROJECT", "nota_fiscal", invoice, "Nota fiscal reconhecida sem obra.", { severity: "warning" });
      issue("NF_WITHOUT_VALID_ALLOCATION", "nota_fiscal", invoice, "Nota fiscal sem rateio e sem obra para apropriação.", { severity: "error" });
    }
    if (Math.abs(allocatedCents - amountCents) > 1) {
      issue("NF_ALLOCATION_MISMATCH", "nota_fiscal", invoice, "Soma dos rateios difere do valor reconhecido.", {
        severity: "error", differenceCents: allocatedCents - amountCents,
      });
    }
    if (linkedThirdMeasurement && Math.abs(thirdMeasurementAmount(linkedThirdMeasurement)-amountCents)>1) {
      issue("THIRD_PARTY_INVOICE_MISMATCH", "nota_fiscal", invoice,
        "O valor da nota fiscal difere da medição do terceiro.", {
          severity:"error",
          differenceCents:amountCents-thirdMeasurementAmount(linkedThirdMeasurement),
        });
    }
    if (!linkedThirdMeasurement) allocations.forEach(allocation => {
      const base = {
        amountCents: allocation.amountCents, date, competence, obraId: allocation.obraId,
        category: invoice.categoria || "material",
        description: `${invoice.tipo?.toUpperCase() || "NF"} ${invoice.numero || id}`,
        counterparty: invoice.fornecedorNome || fornecedores.get(invoice.fornecedorId)?.nome || "",
        sourceType: "nota_fiscal", sourceId: id, sourceSubId: allocation.id,
        documentNumber: invoice.numero || "", legacy: !statusOf(invoice) || statusOf(invoice) === "recebida",
      };
      add({ ...base, id: `nota_fiscal:${id}:allocation:${allocation.id}:cost`, effect: "cost" });
      add({ ...base, id: `nota_fiscal:${id}:allocation:${allocation.id}:payable`, effect: "payable_increase" });
    });
    (invoice.pagamentos || []).filter(active).forEach(payment => {
      const paymentId = sourceId(payment, `${id}|${payment.data}|${payment.valor}|${payment.transacaoId}`);
      const base = {
        amountCents: positiveCents(payment.valor, payment.amount), date: payment.data,
        competence, obraId: payment.obraId || invoice.obraId || allocations[0]?.obraId || "",
        category: invoice.categoria || "material", description: `Pagamento NF ${invoice.numero || id}`,
        counterparty: invoice.fornecedorNome || "", sourceType: "pagamento_nota",
        sourceId: id, sourceSubId: paymentId, documentNumber: invoice.numero || "",
        transactionId: payment.transacaoId || "",
        settlesSourceType: linkedThirdMeasurement ? "medicao_terceiro" : "nota_fiscal",
        settlesSourceId: linkedThirdMeasurement
          ? sourceId(linkedThirdMeasurement, linkedThirdMeasurementId)
          : id,
        metadata:{ conciliado:!!payment.conciliado, origem:payment.origem || "" },
      };
      add({ ...base, id: `nota_fiscal:${id}:payment:${paymentId}:cash`, effect: "cash_out" });
      add({ ...base, id: `nota_fiscal:${id}:payment:${paymentId}:settle`, effect: "payable_decrease" });
    });
  });

  (data.medicoesTerc || []).filter(active).forEach(measurement => {
    const status = statusOf(measurement);
    if (status === "rascunho" || status === "rejeitada") return;
    const id = sourceId(measurement, `${measurement.obraId}|${measurement.tercId}|${measurement.data}|${measurement.total}`);
    const date = isoDate(measurement.data) || isoDate(measurement.dataMedicao)
      || (competenceOf(measurement.competencia) ? `${measurement.competencia}-01` : "");
    const amountCents = thirdMeasurementAmount(measurement);
    const base = {
      amountCents, date, competence: competenceOf(measurement.competencia) || competenceOf(date),
      obraId: measurement.obraId || "", category: "terceirizado",
      description: measurement.descricao || `Medição de terceiro ${measurement.numero || id}`,
      sourceType: "medicao_terceiro", sourceId: id, documentNumber: measurement.numero || "",
    };
    add({ ...base, id: `medicao_terceiro:${id}:cost`, effect: "cost" });
    add({ ...base, id: `medicao_terceiro:${id}:payable`, effect: "payable_increase" });
    const nested = Array.isArray(measurement.pagamentos) ? measurement.pagamentos : [];
    const external = thirdPaymentsByMeasurement.get(measurement.id) || [];
    [...nested, ...external].filter(active).forEach(payment => {
      if ((payment.id && invoicePaymentIds.has(payment.id))
        || (payment.transacaoId && invoicePaymentTransactions.has(payment.transacaoId))) return;
      const paymentId = sourceId(payment, `${id}|${payment.data}|${payment.amount || payment.valor}|${payment.transacaoId}`);
      const paymentBase = {
        ...base, amountCents: positiveCents(payment.amount, payment.valor, payment.liquido),
        date: payment.data || payment.date, sourceType: "pagamento_terceiro", sourceSubId: paymentId,
        transactionId: payment.transacaoId || "", settlesSourceType: "medicao_terceiro", settlesSourceId: id,
        metadata:{ conciliado:!!payment.conciliado, origem:payment.origem || "" },
      };
      add({ ...paymentBase, id: `medicao_terceiro:${id}:payment:${paymentId}:cash`, effect: "cash_out" });
      add({ ...paymentBase, id: `medicao_terceiro:${id}:payment:${paymentId}:settle`, effect: "payable_decrease" });
    });
  });

  const linkedThirdPaymentIds = new Set([...thirdPaymentsByMeasurement.values()].flat().map(item => item.id));
  (data.pagsTerceiros || []).filter(item => active(item) && !linkedThirdPaymentIds.has(item.id)).forEach(payment => {
    const id = sourceId(payment, `${payment.obraId}|${payment.tercId}|${payment.date}|${payment.amount}`);
    const base = {
      amountCents: positiveCents(payment.amount, payment.valor, payment.liquido),
      date: payment.date || payment.data, obraId: payment.obraId || "", category: "terceirizado",
      description: payment.descricao || "Pagamento de terceiro sem medição",
      sourceType: "pagamento_terceiro_legado", sourceId: id, transactionId: payment.transacaoId || "",
      legacy: true, unallocated: true,
      metadata: {
        legacyPaymentBasedCost:true, conciliado:!!payment.conciliado,
        origem:payment.origem || payment.pagador || "",
      },
    };
    if (payment.reconhecerCusto === false) {
      add({ ...base, id: `pagamento_terceiro_legado:${id}:cash`, effect: "cash_out" });
      issue("THIRD_PARTY_PAYMENT_UNALLOCATED", "pagamento_terceiro", payment,
        "Pagamento de terceiro sem medição vinculada; saída mantida fora do DRE até a alocação.", { severity:"info" });
      return;
    }
    add({ ...base, id: `pagamento_terceiro_legado:${id}:cost`, effect: "cost" });
    add({ ...base, id: `pagamento_terceiro_legado:${id}:cash`, effect: "cash_out" });
    issue("THIRD_PARTY_PAYMENT_WITHOUT_MEASUREMENT", "pagamento_terceiro_legado", payment, "Custo reconhecido pelo pagamento por falta de medição.", { severity: "warning" });
  });

  (data.outrasDesp || []).filter(active).forEach(expense => {
    const id = sourceId(expense, `${expense.obraId}|${expense.competencia}|${expense.descricao}|${expense.valor}`);
    const date = isoDate(expense.data) || (competenceOf(expense.competencia) ? `${expense.competencia}-01` : "");
    const base = {
      amountCents: positiveCents(expense.valor), date,
      competence: competenceOf(expense.competencia) || competenceOf(date),
      obraId: expense.obraId || "", category: expense.categoria || "outros",
      description: expense.descricao || "Despesa da obra", sourceType: "outra_despesa", sourceId: id,
    };
    add({ ...base, id: `outra_despesa:${id}:cost`, effect: "cost" });
    const paid = expense.pago === true || expense.dataPagamento || expense.pagamentoId || expense.transacaoId || expense.caixaObraId;
    if (paid) add({ ...base, id: `outra_despesa:${id}:cash`, effect: "cash_out", date: expense.dataPagamento || expense.data, transactionId: expense.transacaoId || "" });
  });

  (data.despesasEmpresa || []).filter(active).forEach(expense => {
    const id = sourceId(expense, `${expense.competencia}|${expense.descricao}|${expense.valor}`);
    const rawCents = toCents(expense.valor);
    const date = isoDate(expense.data) || (competenceOf(expense.competencia) ? `${expense.competencia}-01` : "");
    const base = {
      amountCents: Math.abs(rawCents), date, competence: competenceOf(expense.competencia) || competenceOf(date),
      obraId: "", category: companyExpenseCategory(expense.categoria).id,
      description: expense.descricao || "Despesa corporativa", sourceType: "despesa_empresa", sourceId: id,
      metadata: {
        corporate: true,
        negativeNature: rawCents < 0 ? (expense.naturezaNegativa || "ajuste_legado") : "",
        expenseDetails:{
          fornecedor:expense.fornecedor||"",documento:expense.documento||"",
          centroCusto:expense.centroCusto||"escritorio",vencimento:expense.vencimento||"",
          formaPagamento:expense.formaPagamento||"",cartao:expense.cartao||"",
          parcelas:Number(expense.parcelas||1),pago:expense.pago===true,
          dataPagamento:expense.dataPagamento||"",recorrente:expense.recorrente===true,
          observacao:expense.observacao||"",
        },
      },
    };
    add({ ...base, id: `despesa_empresa:${id}:${rawCents < 0 ? "reversal" : "cost"}`, effect: rawCents < 0 ? "cost_reversal" : "cost" });
    const paid = expense.pago === true || expense.dataPagamento || expense.pagamentoId || expense.transacaoId;
    if (paid) add({ ...base, id: `despesa_empresa:${id}:cash`, effect: rawCents < 0 ? "cash_in" : "cash_out", date: expense.dataPagamento || expense.data, transactionId: expense.transacaoId || "" });
  });

  const payrollSettlementTransactions = new Set();
  (data.titulosFolha || []).filter(active).forEach(title => {
    const id=sourceId(title,`${title.employeeId}|${title.competencia}|${title.liquido}`);
    const totalCents=positiveCents(title.liquido);
    const rawAllocations=(title.rateiosPorObra||[]).filter(item=>positiveCents(item.valor)>0);
    const allocationSum=rawAllocations.reduce((sum,item)=>sum+positiveCents(item.valor),0);
    const allocations=rawAllocations.length
      ? rawAllocations.map(item=>({obraId:item.obraId||"",amountCents:positiveCents(item.valor)}))
      : [{obraId:"",amountCents:totalCents}];
    if(rawAllocations.length&&Math.abs(allocationSum-totalCents)>1)issue(
      "PAYROLL_ALLOCATION_MISMATCH","titulo_folha",title,
      "O rateio do título de folha não fecha com o valor líquido.",{
        severity:"error",differenceCents:allocationSum-totalCents,
      });
    if(!rawAllocations.length)issue(
      "PAYROLL_TITLE_WITHOUT_ALLOCATION","titulo_folha",title,
      "Título de folha sem rateio por obra; obrigação mantida no corporativo.",{severity:"info"},
    );
    allocations.forEach((allocation,index)=>{
      const base={
        amountCents:allocation.amountCents,date:title.vencimento||title.periodoFim||`${title.competencia}-01`,
        competence:title.competencia,obraId:allocation.obraId,category:"mao_obra",
        description:`Folha ${title.funcionarioNome||title.employeeId||id}`,
        sourceType:"titulo_folha",sourceId:id,sourceSubId:`rateio-${index}`,
        metadata:{dueDate:isoDate(title.vencimento),payrollCostRecognizedByAttendance:true},
      };
      add({...base,id:`titulo_folha:${id}:allocation:${index}:payable`,effect:"payable_increase"});
    });
    (title.liquidacoes||[]).filter(active).forEach(settlement=>{
      if(settlement.transacaoId)payrollSettlementTransactions.add(settlement.transacaoId);
      const settlementId=sourceId(settlement,`${id}|${settlement.data}|${settlement.valor}|${settlement.transacaoId}`);
      const settlementCents=positiveCents(settlement.valor);
      let remaining=settlementCents;
      allocations.forEach((allocation,index)=>{
        const proportional=index===allocations.length-1
          ? remaining
          : Math.min(remaining,Math.round(settlementCents*allocation.amountCents/Math.max(totalCents,1)));
        remaining-=proportional;
        if(proportional<=0)return;
        const base={
          amountCents:proportional,date:settlement.data,competence:title.competencia,
          obraId:allocation.obraId,category:"mao_obra",
          description:`Liquidação da folha ${title.funcionarioNome||title.employeeId||id}`,
          sourceType:"pagamento_folha",sourceId:id,sourceSubId:`${settlementId}-rateio-${index}`,
          transactionId:index===0?(settlement.transacaoId||""):"",
          settlesSourceType:"titulo_folha",settlesSourceId:id,
        };
        add({...base,id:`titulo_folha:${id}:settlement:${settlementId}:allocation:${index}:cash`,effect:"cash_out"});
        add({...base,id:`titulo_folha:${id}:settlement:${settlementId}:allocation:${index}:settle`,effect:"payable_decrease"});
      });
    });
  });
  (data.pagamentosFolha||[]).filter(item=>active(item)&&!payrollSettlementTransactions.has(item.transacaoId)).forEach(payment=>{
    const id=sourceId(payment,`${payment.employeeId}|${payment.data}|${payment.valor}|${payment.transacaoId}`);
    add({
      id:`pagamento_folha:${id}:cash`,effect:"cash_out",amountCents:positiveCents(payment.valor),
      date:payment.data,obraId:payment.obraId||"",category:"mao_obra",
      description:"Pagamento de folha sem título vinculado",sourceType:"pagamento_folha",
      sourceId:id,transactionId:payment.transacaoId||"",unallocated:true,
      metadata:{payrollCostRecognizedByAttendance:true},
    });
    issue("PAYROLL_PAYMENT_WITHOUT_TITLE","pagamento_folha",payment,
      "Pagamento de folha sem título vinculado; saída mantida como não alocada.",{severity:"warning"});
  });

  (data.caixaObra || []).filter(active).forEach(entry => {
    const kind = String(entry.tipo || entry.natureza || "").toLowerCase();
    const effect = ["despesa","saida","pagamento"].includes(kind) ? "cash_out" : "cash_in";
    const id = sourceId(entry, `${entry.obraId}|${entry.data}|${entry.valor}|${entry.descricao}`);
    add({
      id:`caixa_obra:${id}:${effect}`, effect, amountCents:positiveCents(entry.valor,entry.amount),
      date:entry.data || entry.date, obraId:entry.obraId || "", category:entry.categoria || "caixa_obra",
      description:entry.descricao || "Movimento do caixa da obra", sourceType:"caixa_obra",
      sourceId:id, sourceSubId:entry.pagamentoId || entry.recebimentoId || "",
      transactionId:entry.transacaoId || "", unallocated:!(entry.notaFiscalId||entry.pedidoId||entry.medicaoId||entry.pagamentoId),
      metadata:{efeitoDRE:entry.efeitoDRE||"sem_efeito"},
    });
  });

  (data.rescisoes || []).filter(active).forEach(rescission => {
    const obra = rescission.obraId ? obras.get(rescission.obraId)
      : [...obras.values()].find(item => item.name === rescission.obraName);
    if (!rescission.obraId && obra) issue("RESCISSION_LINKED_BY_NAME", "rescisao", rescission, "Rescisão vinculada à obra pelo nome legado.", { obraId: obra.id, severity: "info" });
    const id = sourceId(rescission, `${rescission.obraName}|${rescission.demissao}|${rescission.totalLiquido}`);
    add({
      id: `rescisao:${id}:cost`, effect: "cost", amountCents: positiveCents(rescission.totalLiquido, rescission.valor),
      date: rescission.demissao || rescission.data, competence: competenceOf(rescission.competencia || rescission.demissao),
      obraId: rescission.obraId || obra?.id || "", category: "rescisao", description: "Rescisão",
      sourceType: "rescisao", sourceId: id, legacy: !rescission.obraId,
    });
  });

  (options.supplementalEvents || []).forEach(event => add(event));

  const transactionIdsWithCash = new Set(events.filter(event => event.transactionId && ["cash_in", "cash_out"].includes(event.effect)).map(event => event.transactionId));
  (data.transacoes || []).filter(active).forEach(transaction => {
    if (transaction.status === "ignorado" || transactionIdsWithCash.has(transaction.id)) return;
    issue("UNCLASSIFIED_BANK_TRANSACTION", "transacao_bancaria", transaction,
      transaction.status === "conciliado"
        ? "Transação marcada como conciliada sem efeito financeiro vinculado."
        : "Transação bancária ainda não classificada.",
      { severity:transaction.status === "conciliado"?"warning":"info",transactionId:transaction.id });
  });

  const reportOverSettlement = (increaseEffect, decreaseEffect, code, description) => {
    const positions = new Map();
    events.filter(event => [increaseEffect, decreaseEffect].includes(event.effect)).forEach(event => {
      const kind = event.effect === increaseEffect ? event.sourceType : event.settlesSourceType || event.sourceType;
      const id = event.effect === increaseEffect ? event.sourceId : event.settlesSourceId || event.sourceId;
      const key = `${kind}|${id}|${event.obraId}`;
      const position = positions.get(key) || { kind, id, obraId:event.obraId, increaseCents:0, decreaseCents:0 };
      if (event.effect === increaseEffect) position.increaseCents += event.amountCents;
      else position.decreaseCents += event.amountCents;
      positions.set(key, position);
    });
    positions.forEach(position => {
      const differenceCents = position.decreaseCents - position.increaseCents;
      if (differenceCents <= 1) return;
      issue(code, position.kind, { id:position.id, obraId:position.obraId }, description, {
        severity:"error", differenceCents,
      });
    });
  };
  reportOverSettlement(
    "receivable_increase", "receivable_decrease", "RECEIVABLE_OVERPAID",
    "Recebimentos vinculados excedem o valor do documento.",
  );
  reportOverSettlement(
    "payable_increase", "payable_decrease", "PAYABLE_OVERPAID",
    "Pagamentos vinculados excedem o valor da obrigação.",
  );

  events.sort((a, b) => a.id.localeCompare(b.id));
  return {
    events, issues,
    indexes: { obras, fornecedores, transactions, invoicesByOrder, thirdPaymentsByMeasurement, thirdMeasurementByInvoice },
  };
};

const sumEffects = (events, positive, negative) =>
  events.reduce((sum, event) => sum + (positive.includes(event.effect) ? event.amountCents : negative.includes(event.effect) ? -event.amountCents : 0), 0);

const groupEffects = (events, positive, negative, field) => {
  const grouped = {};
  events.forEach(event => {
    const key = event[field] || "outros";
    const signal = positive.includes(event.effect) ? 1 : negative.includes(event.effect) ? -1 : 0;
    if (signal) grouped[key] = (grouped[key] || 0) + (signal * event.amountCents);
  });
  return grouped;
};

const monetaryGroups = centsByKey => Object.fromEntries(
  Object.entries(centsByKey).map(([key, cents]) => [key, fromCents(cents)]),
);

export const selectDRE = (ledger, filters = {}) => {
  const rangeMode = !filters.competence
    && (String(filters.startDate || "").length === 10 || String(filters.endDate || "").length === 10)
    ? "date" : "competence";
  const events = ledger.events.filter(event => eventMatches(event, filters, rangeMode)
    && ["revenue", "revenue_reversal", "cost", "cost_reversal"].includes(event.effect));
  const revenueCents = sumEffects(events, ["revenue"], ["revenue_reversal"]);
  const costCents = sumEffects(events, ["cost"], ["cost_reversal"]);
  const resultCents = revenueCents - costCents;
  const revenueByCategoryCents = groupEffects(events, ["revenue"], ["revenue_reversal"], "category");
  const costByCategoryCents = groupEffects(events, ["cost"], ["cost_reversal"], "category");
  const revenueBySourceCents = groupEffects(events, ["revenue"], ["revenue_reversal"], "sourceType");
  const costBySourceCents = groupEffects(events, ["cost"], ["cost_reversal"], "sourceType");
  return {
    revenueCents, costCents, resultCents,
    revenue: fromCents(revenueCents), costs: fromCents(costCents), result: fromCents(resultCents),
    revenueByCategoryCents, costByCategoryCents, revenueBySourceCents, costBySourceCents,
    revenueByCategory: monetaryGroups(revenueByCategoryCents),
    costByCategory: monetaryGroups(costByCategoryCents),
    revenueBySource: monetaryGroups(revenueBySourceCents),
    costBySource: monetaryGroups(costBySourceCents),
    margin: revenueCents ? resultCents / revenueCents * 100 : 0, events,
  };
};

// Centraliza a leitura das despesas administrativas no razão. Telas de
// controladoria não devem somar `despesasEmpresa` diretamente.
export const selectCorporateOperatingCosts = (ledger, filters = {}) => {
  const events=(ledger?.events||[]).filter(event=>
    !event.obraId&&event.sourceType==="despesa_empresa"
    && eventMatches(event,filters,"competence")
    && ["cost","cost_reversal"].includes(event.effect));
  const costCents=sumEffects(events,["cost"],["cost_reversal"]);
  return {costCents,costs:fromCents(costCents),events};
};

export const selectCashFlow = (ledger, filters = {}) => {
  const events = ledger.events.filter(event => eventMatches(event, filters, "date") && ["cash_in", "cash_out"].includes(event.effect));
  const cashInCents = sumEffects(events, ["cash_in"], []);
  const cashOutCents = sumEffects(events, ["cash_out"], []);
  return {
    cashInCents, cashOutCents, balanceCents: cashInCents - cashOutCents,
    cashIn: fromCents(cashInCents), cashOut: fromCents(cashOutCents), balance: fromCents(cashInCents - cashOutCents), events,
  };
};

const selectPosition = (ledger, filters, increase, decrease) => {
  const relevant = ledger.events.filter(event => eventMatches(event, filters, "date") && [increase, decrease].includes(event.effect));
  const groups = new Map();
  relevant.forEach(event => {
    const key = `${event.settlesSourceType || event.sourceType}|${event.settlesSourceId || event.sourceId}|${event.obraId}`;
    const current = groups.get(key) || { key, sourceType: event.settlesSourceType || event.sourceType, sourceId: event.settlesSourceId || event.sourceId, obraId: event.obraId, increaseCents: 0, decreaseCents: 0, events: [] };
    if (event.effect === increase) current.increaseCents += event.amountCents;
    else current.decreaseCents += event.amountCents;
    current.events.push(event); groups.set(key, current);
  });
  const items = [...groups.values()].map(item => {
    const balanceCents=Math.max(0,item.increaseCents-item.decreaseCents);
    const overpaidCents=Math.max(0,item.decreaseCents-item.increaseCents);
    const dueDate=item.events.find(event=>event.metadata?.dueDate)?.metadata?.dueDate||"";
    const status=balanceCents<=1?"liquidado":item.decreaseCents>0?"parcial":
      dueDate&&filters.asOfDate&&dueDate<filters.asOfDate?"vencido":"aberto";
    return {...item,balanceCents,overpaidCents,dueDate,status};
  });
  return { items, balanceCents: items.reduce((sum, item) => sum + item.balanceCents, 0), overpaidCents: items.reduce((sum, item) => sum + item.overpaidCents, 0) };
};

export const selectAccountsReceivable = (ledger, filters = {}) => selectPosition(ledger, filters, "receivable_increase", "receivable_decrease");
export const selectAccountsPayable = (ledger, filters = {}) => selectPosition(ledger, filters, "payable_increase", "payable_decrease");
export const selectCommitments = (ledger, filters = {}) => selectPosition(ledger, filters, "commitment_increase", "commitment_decrease");

export const selectFinancialMovements = (ledger, filters = {}) =>
  ledger.events.filter(event => eventMatches(event, filters, ["revenue", "cost", "revenue_reversal", "cost_reversal"].includes(event.effect) ? "competence" : "date"))
    .map(event => ({
      id: event.id, origem: event.sourceType, documento: event.documentNumber,
      obraId: event.obraId, categoria: event.category, competencia: event.competence,
      data: event.date, valorCents: event.amountCents, valor: fromCents(event.amountCents),
      natureza: event.effect, status: event.status, sourceId: event.sourceId,
      sourceSubId: event.sourceSubId, transactionId: event.transactionId,
      descricao: event.description, unallocated: event.unallocated,
      metadata:event.metadata,
    }));

export const validateFinancialReconciliation = (ledger, filters = {}, consolidation = null) => {
  const dre = selectDRE(ledger, filters);
  const cash = selectCashFlow(ledger, filters);
  const receivable = selectAccountsReceivable(ledger, { ...filters, startDate: "", endDate: "", competence: "" });
  const payable = selectAccountsPayable(ledger, { ...filters, startDate: "", endDate: "", competence: "" });
  const commitments = selectCommitments(ledger, { ...filters, startDate: "", endDate: "", competence: "" });
  const checks = [];
  const check = (code, expectedCents, actualCents) => checks.push({
    code, ok: Math.abs(expectedCents - actualCents) <= 1,
    expectedCents, actualCents, differenceCents: actualCents - expectedCents,
  });
  check("DRE_RESULT_EQUATION", dre.revenueCents - dre.costCents, dre.resultCents);
  check("CASH_BALANCE_EQUATION", cash.cashInCents - cash.cashOutCents, cash.balanceCents);
  check("DRE_REVENUE_DETAIL_MATCH", dre.revenueCents, sumEffects(dre.events, ["revenue"], ["revenue_reversal"]));
  check("DRE_COST_DETAIL_MATCH", dre.costCents, sumEffects(dre.events, ["cost"], ["cost_reversal"]));
  check("CASH_IN_DETAIL_MATCH", cash.cashInCents, sumEffects(cash.events, ["cash_in"], []));
  check("CASH_OUT_DETAIL_MATCH", cash.cashOutCents, sumEffects(cash.events, ["cash_out"], []));
  check("RECEIVABLE_NON_NEGATIVE", 0, receivable.items.reduce((sum, item) => sum + item.overpaidCents, 0));
  check("PAYABLE_NON_NEGATIVE", 0, payable.items.reduce((sum, item) => sum + item.overpaidCents, 0));
  check("COMMITMENT_NON_NEGATIVE", 0, commitments.items.reduce((sum, item) => sum + item.overpaidCents, 0));
  check("UNIQUE_EVENT_IDS", ledger.events.length, new Set(ledger.events.map(event => event.id)).size);
  check("INTEGER_CENTS", 0, ledger.events.filter(event => !Number.isInteger(event.amountCents)).length);
  check("FINITE_VALUES", 0, ledger.events.filter(event => !Number.isFinite(event.amountCents)).length);
  if (consolidation) check("CONSOLIDATION_EQUATION", consolidation.expectedCents, consolidation.actualCents);
  const errors = [...ledger.issues.filter(item => item.severity === "error"), ...checks.filter(item => !item.ok)];
  return { ok: errors.length === 0, checks, errors, warnings: ledger.issues.filter(item => item.severity !== "error") };
};
