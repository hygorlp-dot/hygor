import { active, buildFinancialLedger, toCents } from "../financeiro/ledger.js";
import { isDateInClosedPeriod } from "../financeiro/workflows.js";

export const CASH_ALLOCATION_KIND = "existing_cash_allocation";
export const reconciliationHold = transaction => String(transaction?.id) === "mt7l9lt5xrta"
  ? "Composição do APORTE GERAL ainda não confirmada. Manter os R$ 7.160,00 pendentes; finalidade informada: mão de obra da B2-04."
  : "";
export const cashAllocations = data => (data?.reconciliationLinks || []).filter(link => link.kind === CASH_ALLOCATION_KIND);
export const activeCashAllocations = data => cashAllocations(data).filter(link => link.status === "active");

// Apenas fatos de caixa já existentes. Uma associação não emite efeito
// econômico: a receita/custo continua pertencendo ao documento original.
export const buildDreCashManagement = (data = {}, { events = null, obraId = "" } = {}) => {
  const ledger = events ? { events } : buildFinancialLedger(data);
  const allocations = activeCashAllocations(data);
  const transactions = (data.transacoes || []).filter(active);
  const transactionMap = new Map(transactions.map(item => [String(item.id), item]));
  const entries = ledger.events.filter(event => ["cash_in", "cash_out"].includes(event.effect)).map(event => {
    const linked = allocations.filter(link => link.eventId === event.id).reduce((sum, link) => sum + link.amountCents, 0);
    const direct = event.transactionId && transactionMap.get(String(event.transactionId))?.status === "conciliado";
    return { ...event, allocatedCents: direct ? event.amountCents : linked,
      remainingCents: direct ? 0 : Math.max(0, event.amountCents - linked),
      funding: event.effect === "cash_in" && (event.sourceType === "caixa_obra" || event.metadata?.funding === true),
    };
  }).filter(event => !obraId || event.obraId === obraId);
  const banks = transactions.map(item => {
    const allocatedCents = allocations.filter(link => link.transactionId === String(item.id)).reduce((sum, link) => sum + link.amountCents, 0);
    const amountCents = Math.abs(toCents(item.valor));
    return { id: String(item.id), date: item.data, description: item.descricao, obraId: item.obraId || "",
      direction: Number(item.valor) > 0 ? "in" : "out", amountCents, allocatedCents,
      remainingCents: item.status === "conciliado" && !allocatedCents ? 0 : Math.max(0, amountCents - allocatedCents),
      status: item.status || "pendente", hold: reconciliationHold(item),
    };
  }).filter(item => !obraId || item.obraId === obraId || allocations.some(link => link.transactionId === item.id && entries.some(entry => entry.id === link.eventId)));
  const ids = new Set(entries.map(entry => entry.id));
  return { entries, banks, allocations: cashAllocations(data).filter(link => ids.has(link.eventId)),
    pendingCents: banks.filter(bank => bank.status !== "ignorado").reduce((sum, bank) => sum + bank.remainingCents, 0),
    issues: ledger.issues || [], source: "dre_ledger", changesFinancialAmounts: false };
};

export const applyCashAllocation = (data, payload, actor, reverse = false) => {
  const fail = motivo => ({ data, resumo: { ok: false, motivo } });
  const transaction = (data.transacoes || []).find(item => String(item.id) === String(payload.transactionId));
  if (!transaction) return fail("Transação não encontrada.");
  if (reconciliationHold(transaction)) return fail(reconciliationHold(transaction));
  if (isDateInClosedPeriod(data,transaction.data)) return fail("O período financeiro do movimento está fechado.");
  const report = buildDreCashManagement(data);
  const bank = report.banks.find(item => item.id === String(transaction.id));
  const now = new Date().toISOString();
  let links = cashAllocations(data);
  let eventId;
  // O histórico de associações é permanente; o log recente de comandos tem
  // retenção limitada. Uma retentativa antiga também não pode duplicar caixa.
  const previous=reverse?null:links.find(link=>link.id===`cashlink_${payload.idempotencyKey}`);
  if(previous){
    if(previous.transactionId!==bank.id||previous.eventId!==payload.eventId||previous.amountCents!==toCents(payload.amount))return fail("A chave deste vínculo já foi utilizada com outros dados.");
    return {data,resumo:{ok:true,idempotent:true,preservedPayments:true,status:bank.status,remainingCents:bank.remainingCents,eventId:previous.eventId}};
  }
  if (reverse) {
    const link = links.find(item => item.id === payload.allocationId && item.transactionId === bank.id && item.status === "active");
    if (!link) return fail("Vínculo ativo não encontrado.");
    if (!String(payload.reason || "").trim()) return fail("Informe o motivo para desfazer o vínculo.");
    eventId = link.eventId;
    links = links.map(item => item.id === link.id ? { ...item, status: "reversed", reversedAt: now, reversedBy: actor.id, reason: String(payload.reason).trim().slice(0, 500) } : item);
  } else {
    if (!["pendente", "parcial"].includes(bank.status)) return fail("A transação não está disponível para vínculo parcial.");
    const entry = report.entries.find(item => item.id === payload.eventId);
    if (!entry) return fail("O registro de caixa não existe mais no DRE.");
    if (entry.transactionId) return fail("O registro já possui associação bancária direta.");
    if (bank.direction !== (entry.effect === "cash_in" ? "in" : "out")) return fail("Entrada e saída não podem ser vinculadas entre si.");
    const value = Number(payload.amount), amountCents = toCents(value);
    if (!Number.isFinite(value) || !Number.isSafeInteger(amountCents) || amountCents <= 0 || Math.abs(value * 100 - amountCents) > 0.000001) return fail("Informe um valor positivo com até duas casas decimais.");
    if (amountCents > bank.remainingCents || amountCents > entry.remainingCents) return fail("O valor supera o saldo disponível no banco ou no registro de caixa.");
    eventId = entry.id;
    links = [...links, { id: `cashlink_${payload.idempotencyKey}`, kind: CASH_ALLOCATION_KIND, eventId,
      transactionId: bank.id, amountCents, status: "active", createdAt: now, createdBy: actor.id,
      obraId: entry.obraId, sourceType: entry.sourceType, sourceId: entry.sourceId, sourceSubId: entry.sourceSubId,
    }];
  }
  const total = links.filter(link => link.transactionId === bank.id && link.status === "active").reduce((sum, link) => sum + link.amountCents, 0);
  const event=report.entries.find(item=>item.id===eventId);
  if(event&&isDateInClosedPeriod(data,event.date))return fail("O período financeiro do registro de caixa está fechado.");
  const status = total === bank.amountCents ? "conciliado" : total > 0 ? "parcial" : "pendente";
  return { data: { ...data,
    reconciliationLinks: [...(data.reconciliationLinks || []).filter(link => link.kind !== CASH_ALLOCATION_KIND), ...links],
    transacoes: (data.transacoes || []).map(item => item.id === transaction.id ? { ...item, status, version: Number(item.version || 0) + 1,
      valorVinculado: total / 100, saldoNaoVinculado: (bank.amountCents - total) / 100, updatedAt: now, updatedById: actor.id } : item),
  }, resumo: { ok: true, eventId, amountCents: total, remainingCents: bank.amountCents - total, status, preservedPayments: true } };
};
