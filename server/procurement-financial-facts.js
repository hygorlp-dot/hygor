import { buildFinancialLedger } from "../src/domains/financeiro/ledger.js";

// Read the same recognition and cancellation rules as the DRE. Receiving stock
// or paying an order never substitutes for a recognized competence document.
export const buildProcurementFinancialFacts = data => {
  const ledger = buildFinancialLedger(data);
  const facts = [];
  for (const order of data?.pedidos || []) {
    const events = ledger.events.filter(event => event.sourceType === "pedido" && event.sourceId === String(order.id));
    const commitment = events.find(event => event.effect === "commitment_increase");
    if (!commitment) continue;
    facts.push({
      legacyType:"pedido", legacyId:String(order.id), category:"purchases", direction:"payable",
      obraId:commitment.obraId, titleAmount:commitment.amountCents / 100,
      recognizedAmount:0, date:commitment.date, dueDate:order.previsao || commitment.date,
      settlements:events.filter(event => event.effect === "cash_out").map(event => ({
        legacyType:"pagamento_pedido", legacyId:event.sourceSubId,
        amount:event.amountCents / 100, date:event.date, bankTransactionLegacyId:event.transactionId,
      })),
      metadata:{numero:order.numero || "", fornecedorId:order.fornecedorId || "",
        recognitionBasis:"document", financialKind:"commitment"},
    });
  }
  const allocatedCosts = new Map();
  for (const event of ledger.events.filter(item => item.sourceType === "nota_fiscal" && item.effect === "cost")) {
    const key = `${event.sourceId}|${event.obraId}`;
    const previous = allocatedCosts.get(key);
    allocatedCosts.set(key, {...event, amountCents:(previous?.amountCents || 0) + event.amountCents});
  }
  for (const event of allocatedCosts.values()) {
    const invoice = (data?.notasFiscais || []).find(item => String(item.id) === event.sourceId);
    const allocations = [...allocatedCosts.values()].filter(item => item.sourceId === event.sourceId);
    const payments = ledger.events.filter(item => item.sourceType === "pagamento_nota" && item.sourceId === event.sourceId && item.effect === "cash_out");
    // A settlement belongs to one allocation only. Preserve the original
    // payment identity and work; do not manufacture proportional payments.
    if (payments.some(payment => !allocations.some(item => item.obraId === payment.obraId))) {
      throw new Error(`Pagamento da nota ${event.sourceId} sem obra compatível com o rateio.`);
    }
    const assigned = payments.filter(payment => payment.obraId === event.obraId);
    facts.push({
      legacyType:"nota_fiscal", legacyId:allocations.length === 1 ? event.sourceId : `${event.sourceId}:${event.obraId}`,
      category:"purchases", direction:"payable", obraId:event.obraId,
      titleAmount:event.amountCents / 100, recognizedAmount:event.amountCents / 100,
      recognitionType:"cost_recognized", date:event.competence && !event.date.startsWith(event.competence) ? `${event.competence}-01` : event.date,
      dueDate:invoice?.vencimento || invoice?.dataVencimento || event.date,
      settlements:assigned.map(payment => ({legacyType:"pagamento_nota", legacyId:payment.sourceSubId,
        amount:payment.amountCents / 100, date:payment.date, bankTransactionLegacyId:payment.transactionId})),
      metadata:{invoiceId:event.sourceId, documentDate:event.date, competence:event.competence,
        pedidoId:invoice?.pedidoId || "", recognitionBasis:"document", financialKind:"document"},
    });
  }
  return facts;
};

// Independent gate: compare persisted purchase recognition with the reason
// consumed by the DRE, by work AND competence, not just with its own writer.
export const compareProcurementDreRecognition = (data, events = []) => {
  const expected = new Map(), actual = new Map();
  const add = (map, work, date, cents) => {
    const key = `${work || "empresa"}|${String(date || "").slice(0, 7)}`;
    map.set(key, (map.get(key) || 0) + cents);
  };
  buildFinancialLedger(data).events.filter(event => event.sourceType === "nota_fiscal" && ["cost", "cost_reversal"].includes(event.effect))
    .forEach(event => add(expected, event.obraId, event.competence, event.amountCents * (event.effect === "cost_reversal" ? -1 : 1)));
  events.filter(event => event.event_type === "cost_recognized" && event.payload?.active !== false && event.payload?.category === "purchases")
    .forEach(event => add(actual, event.payload.obraId, event.effective_date, Math.round(Number(event.payload.amount || 0) * 100)));
  return [...new Set([...expected.keys(), ...actual.keys()])].flatMap(key => {
    const expectedCents = expected.get(key) || 0, actualCents = actual.get(key) || 0;
    return Math.abs(actualCents - expectedCents) > 1 ? [{scope:key, expectedCents, actualCents, differenceCents:actualCents - expectedCents}] : [];
  });
};
