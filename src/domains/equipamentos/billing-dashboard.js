// Central de cobranças (aba "Cobrança por obra"). Domínio puro, sem React.
//
// Esta camada NÃO cria regra financeira. Toda grandeza vem de uma autoridade
// existente e está documentada abaixo e em
// docs/EQUIPAMENTOS_CENTRAL_COBRANCAS.md:
//
//  - Totais da empresa (sem filtro): calcEquipamentosMes (calculations.js) -
//    a mesma conta do DRE de equipamentos. Receita contratual = receita +
//    descontos (= calcEquipFaturamentoEmpresa.receitaBruta); custo = repasse +
//    manutenção paga pela empresa; resultado = lucro; margem = lucro/receita.
//  - Recortes (obra, propriedade, situação, pendência, busca): soma das
//    locações de calcEquipamentosPorObra (bruto, descontos, receita, repasse).
//    LIMITAÇÃO PRESERVADA: a manutenção é apropriada por EQUIPAMENTO, nunca por
//    obra ou locação - por isso só entra no custo quando o recorte é inteiro
//    (sem filtro) ou só de propriedade; nos demais recortes o custo é só o
//    repasse, e o painel diz isso.
//  - Utilização: diárias-unidade da competência ÷ (unidades da frota ativa ×
//    dias da competência) - a mesma fórmula que esta tela já usava.
//  - Faturamento: rentalInvoices/rentalChargeItems (ciclo de cobrança). Ainda
//    NÃO alimenta o DRE - nunca é somado à receita.
import { calcEquipamentosMes, calcEquipamentosPorObra } from "./calculations.js";
import { physicalIdentityForRecord } from "./registry.js";
import { BILLING_LABEL, normalizeText, obraLabel, rentalBilling, rentalSituation } from "./rental-operations.js";
import { monthLabel, shiftMonth } from "./rental-period.js";

const n = value => Number(value || 0);
const sum = (items, pick) => items.reduce((total, item) => total + n(pick(item)), 0);
export const percentOf = (part, total) => (total > 0 ? (part / total) * 100 : null);

// ------------------------------------------------------------- filtros ----
export const PENDING_TYPE = Object.freeze({
  NO_RATE: "sem_tarifa", NO_COST_RATE: "repasse_sem_tarifa", HIGH_DISCOUNT: "desconto_elevado",
  OVERDUE: "fatura_vencida", NEGATIVE: "margem_negativa",
});
export const PENDING_LABEL = Object.freeze({
  sem_tarifa: "Locação sem tarifa", repasse_sem_tarifa: "Repasse sem tarifa de custo",
  desconto_elevado: "Desconto elevado (≥ 20%)", fatura_vencida: "Fatura vencida", margem_negativa: "Obra com resultado negativo",
});

export const DEFAULT_BILLING_FILTERS = Object.freeze({
  obraId: "all", propriedade: "all", situacao: "all", pendencia: "none", busca: "",
});

export const activeBillingFilterCount = (filters = DEFAULT_BILLING_FILTERS) => {
  const f = { ...DEFAULT_BILLING_FILTERS, ...filters };
  return ["obraId", "propriedade", "situacao"].filter(key => f[key] !== "all").length
    + (f.pendencia !== "none" ? 1 : 0) + (normalizeText(f.busca) ? 1 : 0);
};

// --------------------------------------------------------------- linhas ----
// Uma linha por locação com dias na competência (detalhe de
// calcEquipamentosPorObra), enriquecida com obra, proprietário, cobrança e
// pendências. Nada aqui recalcula valor: bruto/descontos/receita/repasse vêm prontos.
const buildRows = (data, matrix, hoje, ownerName) => {
  const rentals = new Map((data.locacoesEquip || []).map(item => [String(item.id), item]));
  const itemsByRental = new Map();
  (data.rentalChargeItems || []).filter(item => item.status !== "cancelled").forEach(item => {
    const key = String(item.rentalId); if (!itemsByRental.has(key)) itemsByRental.set(key, []); itemsByRental.get(key).push(item);
  });
  const invoicesByRental = new Map();
  (data.rentalInvoices || []).filter(item => item.status !== "cancelled").forEach(item => {
    const key = String(item.rentalId); if (!invoicesByRental.has(key)) invoicesByRental.set(key, []); invoicesByRental.get(key).push(item);
  });
  return matrix.linhas.flatMap(line => matrix.obras.flatMap(obra => (line.porObra[obra.id]?.detalhes || []).map(detail => {
    const rental = rentals.get(String(detail.locacaoId)) || {};
    const terceiro = Boolean(line.equip.proprietarioId);
    const invoices = invoicesByRental.get(String(detail.locacaoId)) || [];
    const overdue = invoices.filter(item => ["issued", "partially_paid"].includes(item.status) && n(item.openAmountCents) > 0 && item.dueDate && item.dueDate < hoje);
    const pendencias = [];
    if (detail.semTarifa) pendencias.push(PENDING_TYPE.NO_RATE);
    if (terceiro && n(detail.custoDono) === 0 && n(detail.dias) > 0) pendencias.push(PENDING_TYPE.NO_COST_RATE);
    if (detail.descontoElevado) pendencias.push(PENDING_TYPE.HIGH_DISCOUNT);
    if (overdue.length) pendencias.push(PENDING_TYPE.OVERDUE);
    const billing = rentalBilling({
      cancelled: rental.status === "cancelada", situation: rentalSituation(rental, hoje),
      chargeItems: itemsByRental.get(String(detail.locacaoId)) || [], invoices,
    });
    const identity = physicalIdentityForRecord(data, detail, line.equip);
    const owner = terceiro ? ownerName(line.equip.proprietarioId) : "ARCD (próprio)";
    return {
      ...detail, id: `${detail.locacaoId}:${obra.id}`, obra, obraRotulo: obraLabel(obra) || obra.name || "Obra",
      equipamento: line.equip, terceiro, owner, identity, billing, invoices, overdue, pendencias,
      busca: normalizeText([line.equip.nome, line.equip.patrimonio, line.equip.categoria, identity?.label, obra.name, obra.code, obra.codigo, owner, ...invoices.map(item => item.number)].join(" ")),
    };
  })));
};

const passesRowFilters = (row, f) => {
  if (f.obraId !== "all" && row.obra.id !== f.obraId) return false;
  if (f.propriedade === "proprios" && row.terceiro) return false;
  if (f.propriedade === "terceiros" && !row.terceiro) return false;
  if (f.situacao !== "all" && row.billing.estado !== f.situacao) return false;
  const term = normalizeText(f.busca);
  if (term && !row.busca.includes(term)) return false;
  if (f.pendencia === "qualquer" && !row.pendencias.length) return false;
  if (![...Object.values(PENDING_TYPE), "none", "qualquer"].includes(f.pendencia)) return false;
  if (f.pendencia !== "none" && f.pendencia !== "qualquer" && f.pendencia !== PENDING_TYPE.NEGATIVE && !row.pendencias.includes(f.pendencia)) return false;
  return true;
};

// --------------------------------------------------------- agregações ----
// `maintenance` é o valor de manutenção atribuível ao recorte, ou null quando
// ele não pode ser apropriado (recorte por obra/locação).
const financials = ({ rows, maintenance }) => {
  const receitaContratual = sum(rows, row => row.bruto);
  const descontos = sum(rows, row => row.descontos);
  const receitaLiquida = sum(rows, row => row.receita);
  const repasses = sum(rows, row => row.custoDono);
  const custo = repasses + (maintenance ?? 0);
  const resultado = receitaLiquida - custo;
  return {
    receitaContratual, descontos, receitaLiquida, repasses, manutencao: maintenance, custo, resultado,
    margem: percentOf(resultado, receitaLiquida), manutencaoApropriada: maintenance != null,
    descontosQtd: rows.filter(row => n(row.descontos) > 0.005).length,
    descontosPct: percentOf(descontos, receitaContratual),
  };
};

// Totais da empresa: lidos direto de calcEquipamentosMes (a autoridade do DRE
// de equipamentos), não da soma das linhas.
const companyFinancials = (monthly, rows) => {
  const t = monthly.total;
  return {
    receitaContratual: t.receita + t.descontos, descontos: t.descontos, receitaLiquida: t.receita,
    repasses: t.custoDono, manutencao: t.manut, custo: t.custo, resultado: t.lucro,
    margem: percentOf(t.lucro, t.receita), manutencaoApropriada: true,
    descontosQtd: rows.filter(row => n(row.descontos) > 0.005).length,
    descontosPct: percentOf(t.descontos, t.receita + t.descontos),
  };
};

const daysOf = (inicio, fim) => (inicio && fim ? Math.floor((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000) + 1 : 0);

// --------------------------------------------------------- modelo de tela ----
export const buildBillingDashboard = (data = {}, { ym, hoje, filters = DEFAULT_BILLING_FILTERS, ownerName = () => "Terceiro", withHistory = true } = {}) => {
  const f = { ...DEFAULT_BILLING_FILTERS, ...filters };
  const monthly = calcEquipamentosMes(data, ym);
  const matrix = calcEquipamentosPorObra(data, ym);
  const allRows = buildRows(data, matrix, hoje, ownerName);

  // Obras com resultado negativo são uma pendência de OBRA (não de locação):
  // calculadas sobre todas as linhas da obra, antes dos demais filtros.
  const obraResult = new Map();
  allRows.forEach(row => obraResult.set(row.obra.id, (obraResult.get(row.obra.id) || 0) + n(row.receita) - n(row.custoDono)));
  const negativeObras = new Set([...obraResult].filter(([, value]) => value < 0).map(([id]) => id));

  const rows = allRows.filter(row => passesRowFilters(row, f) && (f.pendencia !== PENDING_TYPE.NEGATIVE || negativeObras.has(row.obra.id)));
  const onlyOwnership = f.obraId === "all" && f.situacao === "all" && f.pendencia === "none" && !normalizeText(f.busca);
  const unfiltered = onlyOwnership && f.propriedade === "all";

  // Manutenção atribuível: todo o mês sem filtro; por propriedade, a dos
  // equipamentos daquela propriedade (calcEquipamentosMes já separa por equipamento).
  const maintenanceFor = ownership => {
    const lines = ownership === "proprios" ? monthly.proprios : ownership === "terceiros" ? monthly.terceiros : monthly.linhas;
    return sum(lines, line => line.manut);
  };
  const finance = unfiltered ? companyFinancials(monthly, rows)
    : financials({ rows, maintenance: onlyOwnership ? maintenanceFor(f.propriedade) : null });

  // Próprios x terceiros: mesmo critério do recorte atual.
  const splitOf = ownership => {
    const subset = rows.filter(row => (ownership === "terceiros" ? row.terceiro : !row.terceiro));
    return financials({ rows: subset, maintenance: onlyOwnership ? maintenanceFor(ownership) : null });
  };
  const split = { proprios: splitOf("proprios"), terceiros: splitOf("terceiros") };
  split.proprios.participacao = percentOf(split.proprios.receitaLiquida, finance.receitaLiquida);
  split.terceiros.participacao = percentOf(split.terceiros.receitaLiquida, finance.receitaLiquida);

  // Operação.
  const days = daysOf(matrix.inicio, matrix.fim);
  const fleet = (data.equipamentos || []).filter(item => item.ativo !== false)
    .filter(item => (f.propriedade === "proprios" ? !item.proprietarioId : f.propriedade === "terceiros" ? Boolean(item.proprietarioId) : true));
  const fleetUnits = sum(fleet, item => Math.max(1, n(item.quantidadeTotal)));
  const unitDays = sum(rows, row => row.unidadeDias);
  const operation = {
    equipamentos: new Set(rows.filter(row => n(row.unidadeDias) > 0).map(row => row.equipamento.id)).size,
    locacoes: rows.length, obras: new Set(rows.map(row => row.obra.id)).size,
    unidadeDias: unitDays, capacidade: fleetUnits * days, utilizacao: percentOf(unitDays, fleetUnits * days), unidadesFrota: fleetUnits,
  };

  // Faturamento (ciclo de cobrança) da competência, das locações do recorte.
  const rentalIds = new Set(rows.map(row => String(row.locacaoId)));
  const invoices = (data.rentalInvoices || []).filter(item => item.status !== "cancelled" && item.competence === ym && (unfiltered || rentalIds.has(String(item.rentalId))));
  const openInvoices = invoices.filter(item => ["issued", "partially_paid"].includes(item.status) && n(item.openAmountCents) > 0);
  const overdueInvoices = openInvoices.filter(item => item.dueDate && item.dueDate < hoje);
  const toInvoice = (data.rentalChargeItems || []).filter(item => item.competence === ym && ["open", "measured"].includes(item.status) && (unfiltered || rentalIds.has(String(item.rentalId))));
  const billing = {
    faturado: sum(invoices, item => item.netAmountCents) / 100, recebido: sum(invoices, item => item.receivedAmountCents) / 100,
    emAberto: sum(openInvoices, item => item.openAmountCents) / 100, vencido: sum(overdueInvoices, item => item.openAmountCents) / 100,
    faturas: invoices.length, faturasEmAberto: openInvoices.length, faturasVencidas: overdueInvoices.length,
    medidoSemFatura: sum(toInvoice, item => item.netAmountCents) / 100, linhasSemFatura: toInvoice.length,
    temDados: invoices.length > 0 || toInvoice.length > 0,
  };

  // Ranking por obra (custo = repasse; manutenção não é apropriada por obra).
  const byObra = new Map();
  rows.forEach(row => {
    const current = byObra.get(row.obra.id) || { obra: row.obra, obraRotulo: row.obraRotulo, rows: [] };
    current.rows.push(row); byObra.set(row.obra.id, current);
  });
  const works = [...byObra.values()].map(group => {
    const fin = financials({ rows: group.rows, maintenance: null });
    const pendencias = group.rows.reduce((total, row) => total + row.pendencias.length, 0) + (negativeObras.has(group.obra.id) ? 1 : 0);
    return {
      id: group.obra.id, obra: group.obra, obraRotulo: group.obraRotulo, nome: group.obra.name || group.obraRotulo,
      codigo: String(group.obra.code || group.obra.codigo || ""), locacoes: group.rows.length,
      equipamentos: new Set(group.rows.map(row => row.equipamento.id)).size, unidadeDias: sum(group.rows, row => row.unidadeDias),
      receita: fin.receitaLiquida, receitaContratual: fin.receitaContratual, descontos: fin.descontos, custo: fin.repasses,
      resultado: fin.resultado, margem: fin.margem, pendencias, negativa: negativeObras.has(group.obra.id), rows: group.rows,
    };
  });

  // Exceções: só fatos que regras existentes já produzem.
  const countPending = type => rows.filter(row => row.pendencias.includes(type)).length;
  const attention = [
    { type: PENDING_TYPE.NO_RATE, count: countPending(PENDING_TYPE.NO_RATE), label: count => `${count} locaç${count === 1 ? "ão" : "ões"} sem tarifa (não gera cobrança)`, tone: "danger" },
    { type: PENDING_TYPE.NO_COST_RATE, count: countPending(PENDING_TYPE.NO_COST_RATE), label: count => `${count} repasse${count === 1 ? "" : "s"} de terceiro sem tarifa de custo`, tone: "danger" },
    { type: PENDING_TYPE.NEGATIVE, count: works.filter(work => work.negativa).length, label: count => `${count} obra${count === 1 ? "" : "s"} com resultado negativo`, tone: "danger" },
    { type: PENDING_TYPE.OVERDUE, count: countPending(PENDING_TYPE.OVERDUE), amount: billing.vencido, label: count => `${count} locaç${count === 1 ? "ão" : "ões"} com fatura vencida`, tone: "danger" },
    { type: PENDING_TYPE.HIGH_DISCOUNT, count: countPending(PENDING_TYPE.HIGH_DISCOUNT), label: count => `${count} desconto${count === 1 ? "" : "s"} elevado${count === 1 ? "" : "s"} (≥ 20%)`, tone: "warning" },
  ].filter(item => item.count > 0).map(item => ({ ...item, label: item.label(item.count) }));

  // Fechamento: explica o estado a partir dos mesmos fatos. O sistema NÃO
  // registra conferência nem fechamento formal da competência - o painel não
  // finge que registra.
  const blocking = countPending(PENDING_TYPE.NO_RATE) + countPending(PENDING_TYPE.NO_COST_RATE);
  const thirdPartyRows = rows.filter(row => row.terceiro);
  const closing = {
    status: rows.length === 0 ? "sem_dados" : blocking > 0 ? "revisar" : "pronto",
    label: rows.length === 0 ? "Sem locações na competência" : blocking > 0 ? "Revisar antes da conferência" : "Pronto para conferência",
    checks: rows.length === 0 ? [] : [
      { ok: countPending(PENDING_TYPE.NO_RATE) === 0, label: `${rows.length - countPending(PENDING_TYPE.NO_RATE)}/${rows.length} locações com tarifa e cobrança calculada` },
      { ok: countPending(PENDING_TYPE.NO_COST_RATE) === 0, label: thirdPartyRows.length ? `${thirdPartyRows.length - countPending(PENDING_TYPE.NO_COST_RATE)}/${thirdPartyRows.length} repasses de terceiros com tarifa de custo` : "Nenhum equipamento de terceiro no recorte" },
      { ok: countPending(PENDING_TYPE.HIGH_DISCOUNT) === 0, label: countPending(PENDING_TYPE.HIGH_DISCOUNT) ? `${countPending(PENDING_TYPE.HIGH_DISCOUNT)} desconto(s) elevado(s) para revisar` : "Nenhum desconto elevado", warning: true },
      { ok: billing.faturasVencidas === 0, label: billing.faturasVencidas ? `${billing.faturasVencidas} fatura(s) vencida(s) no ciclo de cobrança` : "Nenhuma fatura vencida no ciclo de cobrança", warning: true },
    ],
  };

  // Comparação e tendência: o MESMO recorte em outras competências. Uma
  // competência sem locações é "sem dados" - nunca vira zero numa comparação.
  let previous = null; let trend = [];
  if (withHistory) {
    const snapshot = month => {
      const result = buildBillingDashboard(data, { ym: month, hoje, filters: f, ownerName, withHistory: false });
      return result.operation.locacoes ? { ym: month, label: monthLabel(month), ...result.finance, utilizacao: result.operation.utilizacao } : { ym: month, label: monthLabel(month), semDados: true };
    };
    const prev = snapshot(shiftMonth(ym, -1));
    if (!prev.semDados && rows.length) {
      const delta = (now, before) => (before > 0 && now != null ? ((now - before) / before) * 100 : null);
      previous = {
        ym: prev.ym, label: prev.label,
        receitaLiquida: { valor: prev.receitaLiquida, variacaoPct: delta(finance.receitaLiquida, prev.receitaLiquida) },
        resultado: { valor: prev.resultado, diferenca: finance.resultado - prev.resultado, variacaoPct: delta(finance.resultado, prev.resultado) },
        utilizacao: { valor: prev.utilizacao, diferencaPp: prev.utilizacao != null && operation.utilizacao != null ? operation.utilizacao - prev.utilizacao : null },
      };
    }
    trend = Array.from({ length: 6 }, (_, index) => shiftMonth(ym, index - 5)).map(month => (month === ym
      ? (rows.length ? { ym, label: monthLabel(ym), ...finance, utilizacao: operation.utilizacao } : { ym, label: monthLabel(ym), semDados: true })
      : snapshot(month)));
  }

  return {
    ym, label: monthLabel(ym), filters: f, unfiltered, rows, allRows, finance, split, operation, billing,
    works, attention, closing, previous, trend, negativeObras: [...negativeObras],
    monthly, matrix, hasMonthData: allRows.length > 0,
  };
};

// ------------------------------------------------------------ opções ----
// A obra filtrada continua na lista mesmo sem locação na competência, para o
// select e o chip não esconderem um filtro ativo ("Todas as obras" / id cru).
export const buildBillingFilterOptions = (model, data = {}) => {
  const labels = new Map(model.allRows.map(row => [row.obra.id, row.obraRotulo]));
  const selected = model.filters.obraId;
  if (selected !== "all" && !labels.has(selected)) {
    const obra = (data.obras || []).find(item => item.id === selected);
    labels.set(selected, obraLabel(obra) || "Obra sem locação na competência");
  }
  const obras = [...labels.entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return {
    obras: [{ value: "all", label: "Todas as obras" }, ...obras],
    propriedade: [{ value: "all", label: "Próprios + terceiros" }, { value: "proprios", label: "Próprios" }, { value: "terceiros", label: "Terceiros" }],
    situacao: [{ value: "all", label: "Todas" }, ...["pendente", "parcial", "a_faturar", "sem_medicao", "em_dia", "encerrada"].map(value => ({ value, label: BILLING_LABEL[value] }))],
  };
};

export const buildBillingChips = (filters, options) => {
  const f = { ...DEFAULT_BILLING_FILTERS, ...filters };
  const labelOf = (list, value) => list.find(item => item.value === value)?.label || value;
  const chips = [];
  if (f.obraId !== "all") chips.push({ id: "obraId", label: labelOf(options.obras, f.obraId) });
  if (f.propriedade !== "all") chips.push({ id: "propriedade", label: labelOf(options.propriedade, f.propriedade) });
  if (f.situacao !== "all") chips.push({ id: "situacao", label: `Cobrança: ${labelOf(options.situacao, f.situacao)}` });
  if (f.pendencia !== "none") chips.push({ id: "pendencia", label: f.pendencia === "qualquer" ? "Somente com pendência" : PENDING_LABEL[f.pendencia] });
  if (normalizeText(f.busca)) chips.push({ id: "busca", label: `Busca: “${f.busca.trim()}”` });
  return chips;
};

// Legenda de escopo de todo indicador ("Setembro 2026 · todas as obras").
export const billingScopeLabel = (model, options) => {
  const f = model.filters;
  const obra = f.obraId === "all" ? "todas as obras" : options.obras.find(item => item.value === f.obraId)?.label || "obra selecionada";
  const parts = [model.label, obra];
  if (f.propriedade !== "all") parts.push(f.propriedade === "proprios" ? "próprios" : "terceiros");
  if (f.situacao !== "all" || f.pendencia !== "none" || normalizeText(f.busca)) parts.push("filtros ativos");
  return parts.join(" · ");
};

// Ordenação do ranking por obra.
export const WORK_SORT_KEYS = ["nome", "locacoes", "receita", "custo", "resultado", "margem", "pendencias"];
export const sortWorks = (works, sort = { key: "receita", dir: "desc" }) => {
  const sign = sort.dir === "asc" ? 1 : -1;
  const value = work => (sort.key === "nome" ? work.nome : work[sort.key] ?? -Infinity);
  return [...works].sort((a, b) => {
    const left = value(a), right = value(b);
    const base = typeof left === "string" ? left.localeCompare(right, "pt-BR") : left - right;
    return sign * base || a.nome.localeCompare(b.nome, "pt-BR");
  });
};

// Memória da obra (drill-down): identificação, operação, financeiro,
// cobrança, equipamentos e pendências - tudo a partir das linhas do recorte.
export const buildWorkMemory = (model, workId) => {
  const work = model.works.find(item => item.id === workId);
  if (!work) return null;
  const fin = financials({ rows: work.rows, maintenance: null });
  const invoices = work.rows.flatMap(row => row.invoices).filter((item, index, list) => list.findIndex(other => other.id === item.id) === index);
  const open = invoices.filter(item => ["issued", "partially_paid"].includes(item.status) && n(item.openAmountCents) > 0);
  const pendencias = work.rows.flatMap(row => row.pendencias.map(type => ({ type, label: PENDING_LABEL[type], equipamento: row.equipamento.nome, locacaoId: row.locacaoId })));
  if (work.negativa) pendencias.unshift({ type: PENDING_TYPE.NEGATIVE, label: PENDING_LABEL[PENDING_TYPE.NEGATIVE], equipamento: "", locacaoId: "" });
  return {
    work, finance: fin,
    billing: {
      faturado: sum(invoices, item => item.netAmountCents) / 100, recebido: sum(invoices, item => item.receivedAmountCents) / 100,
      emAberto: sum(open, item => item.openAmountCents) / 100, faturas: invoices.length,
    },
    rows: [...work.rows].sort((a, b) => String(a.equipamento.nome).localeCompare(String(b.equipamento.nome), "pt-BR") || String(a.inicio).localeCompare(String(b.inicio))),
    pendencias,
  };
};

// Resultado por obra para o gráfico de barras horizontais (maior -> menor).
export const workResultBars = model => {
  const works = sortWorks(model.works, { key: "resultado", dir: "desc" });
  const max = Math.max(1, ...works.map(work => Math.abs(work.resultado)));
  return works.map(work => ({ id: work.id, label: work.obraRotulo, value: work.resultado, ratio: Math.abs(work.resultado) / max, negative: work.resultado < 0 }));
};
