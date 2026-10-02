// Central operacional de locações (aba "Locações" da Central de locação de
// equipamentos). Domínio puro: não depende de React, DOM ou API.
//
// Esta camada só ORGANIZA o que já existe - período, obra, situação,
// cobrança, busca, ordenação, agrupamento e totais. Nenhuma regra financeira
// nasce aqui: valores vêm de cobrancaLocacao/diasLocacaoNoPeriodo
// (calculations.js, a mesma fonte de calcEquipamentosMes e do DRE), saldos
// vêm dos campos que os comandos de fatura/recebimento já gravam
// (rentalInvoices.openAmountCents etc.) e o ciclo de vida continua sendo o de
// rental-lifecycle.js. Qualquer regra ambígua fica como está e documentada
// em docs/EQUIPAMENTOS_CENTRAL_OPERACIONAL_LOCACOES.md.
import { cobrancaLocacao, diasLocacaoNoPeriodo, disponibilidadeNoDia, textoComposicao } from "./calculations.js";
import { RENTAL_CHECKPOINT_TYPE, rentalDeliveryBalance, rentalDispatchBalance, rentalReturnBalance } from "./rental-checkpoints.js";
import { availableRentalTransitions, normalizeRentalState, rentalStateLabel } from "./rental-lifecycle.js";

// ---------------------------------------------------------------- datas ----
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = n => String(n).padStart(2, "0");
const parseIso = iso => { const [y, m, d] = String(iso).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toIso = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const isIso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

export const addDays = (iso, amount) => { const d = parseIso(iso); d.setUTCDate(d.getUTCDate() + amount); return toIso(d); };
export const daysBetween = (from, to) => Math.round((parseIso(to) - parseIso(from)) / 86400000);
export const monthOf = iso => String(iso || "").slice(0, 7);
export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
export const monthBounds = ym => {
  const [y, m] = ym.split("-").map(Number);
  return { inicio: `${ym}-01`, fim: toIso(new Date(Date.UTC(y, m, 0))) };
};
export const monthLabel = ym => { const [y, m] = String(ym || "").split("-").map(Number); return MESES[m - 1] ? `${MESES[m - 1]} ${y}` : ""; };
export const formatDate = iso => { if (!isIso(iso)) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y.slice(2)}`; };
export const formatDateFull = iso => { if (!isIso(iso)) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
// Mesmo formato de fmt() em LegacyApp.jsx - a tela inteira fala o mesmo "R$ 1.234,56".
export const formatMoney = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const listDays = (inicio, fim, limit = 3660) => {
  const out = [];
  if (!isIso(inicio) || !isIso(fim) || fim < inicio) return out;
  for (let cursor = inicio; cursor <= fim && out.length < limit; cursor = addDays(cursor, 1)) out.push(cursor);
  return out;
};

// -------------------------------------------------------------- período ----
export const PERIOD_PRESET = Object.freeze({
  TODAY: "hoje", WEEK: "semana", MONTH: "mes", LAST_30: "30d", CUSTOM: "personalizado", ALL: "tudo",
});

// state: { preset, ym?, inicio?, fim? }  ->  janela efetiva [inicio, fim].
// "Este mês" e "Mês anterior" são o mesmo preset MONTH com `ym` diferente -
// é isso que permite navegar com ‹ › sem inventar um segundo modelo.
export const resolveRentalPeriod = (state = {}, { hoje, rentals = [] } = {}) => {
  const preset = state.preset || PERIOD_PRESET.MONTH;
  if (preset === PERIOD_PRESET.TODAY) {
    return { preset, inicio: hoje, fim: hoje, label: `Hoje · ${formatDate(hoje)}`, mensal: false };
  }
  if (preset === PERIOD_PRESET.WEEK) {
    const dow = parseIso(hoje).getUTCDay();
    const inicio = addDays(hoje, -((dow + 6) % 7));
    const fim = addDays(inicio, 6);
    return { preset, inicio, fim, label: `Esta semana · ${formatDate(inicio)} → ${formatDate(fim)}`, mensal: false };
  }
  if (preset === PERIOD_PRESET.LAST_30) {
    return { preset, inicio: addDays(hoje, -29), fim: hoje, label: `Últimos 30 dias · ${formatDate(addDays(hoje, -29))} → ${formatDate(hoje)}`, mensal: false };
  }
  if (preset === PERIOD_PRESET.CUSTOM) {
    let { inicio, fim } = state;
    if (isIso(inicio) && isIso(fim)) {
      if (fim < inicio) [inicio, fim] = [fim, inicio];
      return { preset, inicio, fim, label: `${formatDate(inicio)} → ${formatDate(fim)}`, mensal: false };
    }
    // Datas incompletas: cai no mês atual em vez de uma janela vazia.
    const bounds = monthBounds(monthOf(hoje));
    return { preset, ...bounds, label: `${formatDate(bounds.inicio)} → ${formatDate(bounds.fim)}`, mensal: false, incompleto: true };
  }
  if (preset === PERIOD_PRESET.ALL) {
    const starts = rentals.map(item => item.inicio).filter(isIso).sort();
    const ends = rentals.map(item => item.fim).filter(isIso).sort();
    const inicio = starts[0] || hoje;
    const fim = [hoje, ends.at(-1)].filter(Boolean).sort().at(-1);
    return { preset, inicio, fim, label: "Todo o período", mensal: false };
  }
  const ym = /^\d{4}-\d{2}$/.test(String(state.ym || "")) ? state.ym : monthOf(hoje);
  return { preset: PERIOD_PRESET.MONTH, ym, ...monthBounds(ym), label: monthLabel(ym), mensal: true };
};

// Valor exibido no seletor: os atalhos "Este mês"/"Mês anterior" são o mesmo
// preset MONTH apontando para um ym; um mês navegado além disso vira "mes:YYYY-MM".
export const periodSelectValue = (state = {}, hoje) => {
  const preset = state.preset || PERIOD_PRESET.MONTH;
  if (preset !== PERIOD_PRESET.MONTH) return preset;
  const ym = state.ym || monthOf(hoje);
  if (ym === monthOf(hoje)) return "mes";
  if (ym === shiftMonth(monthOf(hoje), -1)) return "mes_anterior";
  return `mes:${ym}`;
};

export const periodSelectOptions = (state = {}, hoje) => {
  const options = [
    { value: PERIOD_PRESET.TODAY, label: "Hoje" },
    { value: PERIOD_PRESET.WEEK, label: "Esta semana" },
    { value: "mes", label: "Este mês" },
    { value: "mes_anterior", label: "Mês anterior" },
    { value: PERIOD_PRESET.LAST_30, label: "Últimos 30 dias" },
    { value: PERIOD_PRESET.CUSTOM, label: "Personalizado" },
    { value: PERIOD_PRESET.ALL, label: "Todo o período" },
  ];
  const current = periodSelectValue(state, hoje);
  if (current.startsWith("mes:")) options.splice(4, 0, { value: current, label: monthLabel(current.slice(4)) });
  return options;
};

export const periodStateFromSelect = (value, hoje, previous = {}) => {
  if (value === "mes") return { preset: PERIOD_PRESET.MONTH, ym: monthOf(hoje) };
  if (value === "mes_anterior") return { preset: PERIOD_PRESET.MONTH, ym: shiftMonth(monthOf(hoje), -1) };
  if (String(value).startsWith("mes:")) return { preset: PERIOD_PRESET.MONTH, ym: String(value).slice(4) };
  if (value === PERIOD_PRESET.CUSTOM) {
    const base = resolveRentalPeriod(previous, { hoje });
    return { preset: PERIOD_PRESET.CUSTOM, inicio: previous.inicio || base.inicio, fim: previous.fim || base.fim };
  }
  return { preset: value };
};

// ------------------------------------------------------ situação/cobrança ----
export const RENTAL_SITUATION = Object.freeze({
  ACTIVE: "em_andamento", SCHEDULED: "programada", CLOSED: "encerrada", CANCELLED: "cancelada",
});
export const RENTAL_SITUATION_LABEL = Object.freeze({
  em_andamento: "Em andamento", programada: "Programada", encerrada: "Encerrada", cancelada: "Cancelada",
});
const SITUATION_ORDER = ["em_andamento", "programada", "encerrada", "cancelada"];

export const BILLING_STATE = Object.freeze({
  OK: "em_dia", PENDING: "pendente", PARTIAL: "parcial", TO_INVOICE: "a_faturar", NONE: "sem_medicao", CLOSED: "encerrada",
});
export const BILLING_LABEL = Object.freeze({
  em_dia: "Em dia", pendente: "Pendente", parcial: "Parcial", a_faturar: "A faturar", sem_medicao: "Sem medição", encerrada: "Encerrada",
});
// Quanto maior a urgência, mais cedo na ordenação por cobrança.
const BILLING_ORDER = ["pendente", "parcial", "a_faturar", "sem_medicao", "em_dia", "encerrada"];

// Situação funcional exibida na tela. Não substitui o ciclo de vida
// (lifecycleState), que continua aparecendo como detalhe da linha.
//  - cancelada: status "cancelada" (é o que "Excluir locação" grava);
//  - programada: ainda não começou;
//  - encerrada: tem data de término já vencida;
//  - em andamento: o resto (inclui contrato com término futuro, que ainda corre).
export const rentalSituation = (rental, hoje) => {
  if (rental?.status === "cancelada") return RENTAL_SITUATION.CANCELLED;
  if (isIso(rental?.inicio) && rental.inicio > hoje) return RENTAL_SITUATION.SCHEDULED;
  if (isIso(rental?.fim) && rental.fim < hoje) return RENTAL_SITUATION.CLOSED;
  return RENTAL_SITUATION.ACTIVE;
};

const sum = (items, pick) => items.reduce((total, item) => total + Number(pick(item) || 0), 0);

export const rentalBilling = ({ cancelled, situation, chargeItems, invoices }) => {
  const itemsAFaturar = chargeItems.filter(item => ["open", "measured"].includes(item.status));
  const medido = sum(chargeItems, item => item.netAmountCents);
  const faturado = sum(invoices, item => item.netAmountCents);
  const aberto = sum(invoices.filter(item => ["issued", "partially_paid"].includes(item.status)), item => item.openAmountCents);
  const recebido = sum(invoices, item => item.receivedAmountCents);
  const aFaturar = sum(itemsAFaturar, item => item.netAmountCents);
  let estado;
  if (cancelled) estado = BILLING_STATE.CLOSED;
  else if (aberto > 0 && recebido > 0) estado = BILLING_STATE.PARTIAL;
  else if (aberto > 0) estado = BILLING_STATE.PENDING;
  else if (aFaturar > 0) estado = BILLING_STATE.TO_INVOICE;
  else if (!chargeItems.length && !invoices.length) estado = BILLING_STATE.NONE;
  else estado = situation === RENTAL_SITUATION.CLOSED ? BILLING_STATE.CLOSED : BILLING_STATE.OK;
  return {
    estado, label: BILLING_LABEL[estado], medidoCents: medido, faturadoCents: faturado, abertoCents: aberto,
    recebidoCents: recebido, aFaturarCents: aFaturar, linhas: chargeItems.length, faturas: invoices.length,
  };
};

// ---------------------------------------------------------------- linhas ----
export const normalizeText = value => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const obraLabel = obra => {
  const code = String(obra?.code || obra?.codigo || "").trim();
  const name = String(obra?.name || obra?.nome || "").trim();
  if (code && name) return normalizeText(name).startsWith(normalizeText(code)) ? name : `${code} — ${name}`;
  return name || code || "";
};

export const NO_WORK = "__sem_obra__";

const groupBy = (items, pick) => {
  const map = new Map();
  (items || []).forEach(item => { const key = String(pick(item) ?? ""); if (!map.has(key)) map.set(key, []); map.get(key).push(item); });
  return map;
};

// Uma linha por locação, já com tudo que a tabela, os filtros e o detalhe
// precisam. `periodo` só decide o recorte de valor/dias; nada aqui grava.
export const buildRentalRows = (data = {}, { periodo, hoje }) => {
  const equipamentos = new Map((data.equipamentos || []).map(item => [String(item.id), item]));
  const obras = new Map((data.obras || []).map(item => [String(item.id), item]));
  const donos = new Map((data.proprietariosEquip || []).map(item => [String(item.id), item]));
  const units = new Map((data.equipmentUnits || []).map(item => [String(item.id), item]));
  const itemsByRental = groupBy((data.rentalChargeItems || []).filter(item => item.status !== "cancelled"), item => item.rentalId);
  const invoicesByRental = groupBy((data.rentalInvoices || []).filter(item => item.status !== "cancelled"), item => item.rentalId);

  return (data.locacoesEquip || []).map(rental => {
    const equipment = equipamentos.get(String(rental.equipamentoId));
    const obra = obras.get(String(rental.obraId));
    const dono = equipment?.proprietarioId ? donos.get(String(equipment.proprietarioId)) : null;
    const situacao = rentalSituation(rental, hoje);
    const cancelada = situacao === RENTAL_SITUATION.CANCELLED;
    const emAberto = !cancelada && !rental.fim;
    const lifecycleState = normalizeRentalState(rental.lifecycleState || rental.status);
    const chargeItems = itemsByRental.get(String(rental.id)) || [];
    const invoices = invoicesByRental.get(String(rental.id)) || [];
    const openInvoices = invoices.filter(item => ["issued", "partially_paid"].includes(item.status) && Number(item.openAmountCents || 0) > 0);
    const quantidade = Math.max(1, Number(rental.quantidade || 1));

    const diasNoPeriodo = periodo.preset === PERIOD_PRESET.ALL
      ? (isIso(rental.inicio) ? Math.max(1, diasLocacaoNoPeriodo(rental, periodo.inicio, periodo.fim)) : 0)
      : diasLocacaoNoPeriodo(rental, periodo.inicio, periodo.fim);
    const cobPeriodo = diasNoPeriodo && !cancelada ? cobrancaLocacao(rental, equipment, diasNoPeriodo) : null;
    // Valor acumulado do contrato até hoje (ou até o término): é o número que a
    // lista antiga mostrava - continua disponível no detalhe.
    const diasContrato = isIso(rental.inicio) ? Math.max(0, daysBetween(rental.inicio, rental.fim || hoje) + 1) : 0;
    const cobContrato = diasContrato && !cancelada ? cobrancaLocacao(rental, equipment, diasContrato) : null;

    const plannedEnd = rental.plannedEndDate || rental.dataPrevistaFim || "";
    let vencimento = null;
    if (situacao === RENTAL_SITUATION.ACTIVE && !rental.fim && isIso(plannedEnd)) {
      const restantes = daysBetween(hoje, plannedEnd);
      if (restantes < 0) vencimento = { tipo: "vencida", dias: -restantes };
      else if (restantes <= 7) vencimento = { tipo: "vence", dias: restantes };
    }

    const unitTags = (rental.equipmentUnitIds || []).map(id => units.get(String(id))?.assetTag).filter(Boolean);
    const row = {
      id: String(rental.id), rental, situacao, cancelada, emAberto, lifecycleState,
      lifecycleLabel: rental.lifecycleState ? rentalStateLabel(lifecycleState) : "",
      equipamentoId: String(rental.equipamentoId || ""), equipamentoNome: equipment?.nome || "Equipamento sem cadastro",
      equipamentoCodigo: String(equipment?.patrimonio || ""), categoria: String(equipment?.categoria || ""),
      unidades: unitTags, quantidade,
      obraId: String(rental.obraId || ""), obraNome: obra ? String(obra.name || obra.nome || "") : "",
      obraCodigo: String(obra?.code || obra?.codigo || ""),
      obraRotulo: obra ? obraLabel(obra) : (rental.obraId ? "Obra não encontrada" : "Sem obra"),
      proprietarioId: String(equipment?.proprietarioId || ""), proprio: !equipment?.proprietarioId,
      proprietarioNome: equipment?.proprietarioId ? (dono?.nome || "Terceiro") : "ARCD (próprio)",
      inicio: String(rental.inicio || ""), fim: String(rental.fim || ""), plannedEnd: String(plannedEnd || ""),
      diasNoPeriodo, vencimento,
      valorPeriodo: cobPeriodo?.liquido || 0, descontoPeriodo: cobPeriodo?.desconto || 0,
      semTarifa: Boolean(cobPeriodo?.semTarifa), composicao: cobPeriodo && !cobPeriodo.semTarifa ? textoComposicao(cobPeriodo.composicao) : "",
      valorAcumulado: cobContrato?.liquido || 0, diasContrato, semTarifaContrato: Boolean(cobContrato?.semTarifa),
      cobranca: rentalBilling({ cancelled: cancelada, situation: situacao, chargeItems, invoices }),
      chargeItems, invoices, openInvoices,
      hasItemsToInvoice: chargeItems.some(item => ["open", "measured"].includes(item.status)),
    };
    row.busca = normalizeText([
      row.id, row.equipamentoNome, row.equipamentoCodigo, row.categoria, ...unitTags, row.obraRotulo, row.obraNome, row.obraCodigo,
      row.proprietarioNome, row.lifecycleLabel, RENTAL_SITUATION_LABEL[situacao], ...invoices.map(item => item.number),
    ].join(" "));
    return row;
  });
};

// --------------------------------------------------------------- filtros ----
export const DEFAULT_FILTERS = Object.freeze({
  obraId: "all", cobranca: "all", proprietario: "all", categoria: "all", busca: "",
});

// Período + obra + cobrança + proprietário + categoria + busca. A situação
// fica de fora de propósito: ela é a navegação (abas internas) e as contagens
// de cada aba precisam refletir ESTE contexto.
export const applyRentalFilters = (rows, filters = DEFAULT_FILTERS, periodo) => {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const term = normalizeText(f.busca);
  return rows.filter(row => {
    if (periodo?.preset !== PERIOD_PRESET.ALL && !(row.diasNoPeriodo > 0)) return false;
    if (f.obraId !== "all" && (f.obraId === NO_WORK ? row.obraId !== "" : row.obraId !== f.obraId)) return false;
    if (f.cobranca !== "all" && row.cobranca.estado !== f.cobranca) return false;
    if (f.proprietario === "proprio" && !row.proprio) return false;
    if (f.proprietario === "terceiros" && row.proprio) return false;
    if (!["all", "proprio", "terceiros"].includes(f.proprietario) && row.proprietarioId !== f.proprietario) return false;
    if (f.categoria !== "all" && row.categoria !== f.categoria) return false;
    if (term && !row.busca.includes(term)) return false;
    return true;
  });
};

export const countBySituation = rows => {
  const counts = { todas: rows.length };
  SITUATION_ORDER.forEach(key => { counts[key] = 0; });
  rows.forEach(row => { counts[row.situacao] += 1; });
  return counts;
};

export const filterBySituation = (rows, situation) => situation === "todas" ? rows : rows.filter(row => row.situacao === situation);

export const activeFilterCount = (filters = DEFAULT_FILTERS) => {
  const f = { ...DEFAULT_FILTERS, ...filters };
  return ["obraId", "cobranca", "proprietario", "categoria"].filter(key => f[key] !== "all").length + (normalizeText(f.busca) ? 1 : 0);
};

// ------------------------------------------------------------- ordenação ----
export const SORT_KEYS = ["equipamento", "obra", "inicio", "fim", "valor", "situacao", "cobranca"];
const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const far = "9999-12-31";
const sortValue = {
  equipamento: row => row.equipamentoNome, obra: row => row.obraRotulo, inicio: row => row.inicio || far,
  fim: row => row.fim || far, valor: row => row.valorPeriodo,
  situacao: row => SITUATION_ORDER.indexOf(row.situacao), cobranca: row => BILLING_ORDER.indexOf(row.cobranca.estado),
  vencimento: row => row.plannedEnd || row.fim || far,
};

// Ordenação padrão por aba: histórico = mais recentes primeiro; em andamento =
// quem vence antes aparece antes (o que pede ação primeiro); programadas = a
// que entra primeiro. O usuário sobrescreve clicando no cabeçalho.
export const defaultSortFor = situation => {
  if (situation === RENTAL_SITUATION.ACTIVE) return { key: "vencimento", dir: "asc" };
  if (situation === RENTAL_SITUATION.SCHEDULED) return { key: "inicio", dir: "asc" };
  return { key: "inicio", dir: "desc" };
};

export const sortRentalRows = (rows, sort, situation = "todas") => {
  const { key, dir } = sort || defaultSortFor(situation);
  const pick = sortValue[key] || sortValue.inicio;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = pick(a), right = pick(b);
    const base = typeof left === "number" && typeof right === "number" ? left - right : collator.compare(String(left), String(right));
    return sign * base || collator.compare(a.equipamentoNome, b.equipamentoNome) || collator.compare(a.id, b.id);
  });
};

// ------------------------------------------------------------ agrupamento ----
export const GROUP_OPTIONS = [
  { value: "none", label: "Nenhum" }, { value: "obra", label: "Obra" }, { value: "equipamento", label: "Equipamento" },
  { value: "proprietario", label: "Proprietário" }, { value: "situacao", label: "Situação" }, { value: "mes", label: "Mês de início" },
];
const groupDefs = {
  obra: row => ({ key: row.obraId || NO_WORK, label: row.obraRotulo }),
  equipamento: row => ({ key: row.equipamentoId || row.equipamentoNome, label: row.equipamentoNome }),
  proprietario: row => ({ key: row.proprietarioId || "proprio", label: row.proprietarioNome }),
  situacao: row => ({ key: row.situacao, label: RENTAL_SITUATION_LABEL[row.situacao] }),
  mes: row => ({ key: monthOf(row.inicio) || "sem_data", label: monthLabel(monthOf(row.inicio)) || "Sem data de início" }),
};

// `rows` já chega ordenado; a ordem interna de cada grupo é preservada. O
// total do grupo é do grupo inteiro (não da página mostrada).
export const groupRentalRows = (rows, groupKey) => {
  const def = groupDefs[groupKey];
  if (!def) return null;
  const groups = new Map();
  rows.forEach(row => {
    const { key, label } = def(row);
    if (!groups.has(key)) groups.set(key, { key, label, rows: [] });
    groups.get(key).rows.push(row);
  });
  const result = [...groups.values()].map(group => ({ ...group, count: group.rows.length, valor: sum(group.rows, row => row.valorPeriodo) }));
  if (groupKey === "situacao") result.sort((a, b) => SITUATION_ORDER.indexOf(a.key) - SITUATION_ORDER.indexOf(b.key));
  else if (groupKey === "mes") result.sort((a, b) => b.key.localeCompare(a.key));
  else result.sort((a, b) => collator.compare(a.label, b.label));
  return result;
};

export const summarizeRentalRows = rows => ({
  locacoes: rows.length,
  obras: new Set(rows.map(row => row.obraId).filter(Boolean)).size,
  equipamentos: new Set(rows.map(row => row.equipamentoId)).size,
  valor: sum(rows, row => row.valorPeriodo),
});

export const paginate = (items, page, pageSize) => {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(0, page), pageCount - 1);
  const start = current * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageCount, total: items.length, from: items.length ? start + 1 : 0, to: Math.min(items.length, start + pageSize) };
};

// -------------------------------------------------------------- opções ----
export const buildFilterOptions = (data = {}, rows = []) => {
  const obrasById = new Map((data.obras || []).map(obra => [String(obra.id), obra]));
  const obraOptions = [...obrasById.values()].map(obra => ({ value: String(obra.id), label: obraLabel(obra) || "Obra sem nome" }));
  rows.forEach(row => { if (row.obraId && !obrasById.has(row.obraId) && !obraOptions.some(opt => opt.value === row.obraId)) obraOptions.push({ value: row.obraId, label: row.obraRotulo }); });
  obraOptions.sort((a, b) => collator.compare(a.label, b.label));
  const hasNoWork = rows.some(row => !row.obraId);
  const owners = [...new Map(rows.filter(row => row.proprietarioId).map(row => [row.proprietarioId, row.proprietarioNome])).entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => collator.compare(a.label, b.label));
  const categories = [...new Set(rows.map(row => row.categoria).filter(Boolean))].sort(collator.compare).map(value => ({ value, label: value }));
  return {
    obras: [{ value: "all", label: "Todas as obras" }, ...obraOptions, ...(hasNoWork ? [{ value: NO_WORK, label: "Sem obra" }] : [])],
    cobranca: [{ value: "all", label: "Todas" }, ...BILLING_ORDER.map(value => ({ value, label: BILLING_LABEL[value] }))],
    proprietarios: [{ value: "all", label: "Todos" }, { value: "proprio", label: "ARCD (próprio)" }, { value: "terceiros", label: "Terceiros" }, ...owners],
    categorias: [{ value: "all", label: "Todas" }, ...categories],
  };
};

// ------------------------------------------------------------------ KPIs ----
const MAX_FREE_UNITS_DAYS = 92;

// KPIs do CONTEXTO atual (período + filtros, todas as situações) - `rows` são
// as linhas já filtradas, ainda sem o recorte de situação.
export const computeRentalKpis = (data = {}, rows = [], periodo, filters = DEFAULT_FILTERS) => {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const active = rows.filter(row => !row.cancelada && row.diasNoPeriodo > 0);
  const days = listDays(periodo.inicio, periodo.fim);
  const index = new Map(days.map((iso, position) => [iso, position]));

  // Escopo de frota: equipamentos ativos + os das linhas, respeitando proprietário/categoria.
  const registry = new Map((data.equipamentos || []).filter(item => item.ativo !== false).map(item => [String(item.id), item]));
  active.forEach(row => { if (!registry.has(row.equipamentoId)) registry.set(row.equipamentoId, (data.equipamentos || []).find(item => String(item.id) === row.equipamentoId) || { id: row.equipamentoId, quantidadeTotal: row.quantidade }); });
  const scope = [...registry.values()].filter(item => {
    if (f.proprietario === "proprio" && item.proprietarioId) return false;
    if (f.proprietario === "terceiros" && !item.proprietarioId) return false;
    if (!["all", "proprio", "terceiros"].includes(f.proprietario) && String(item.proprietarioId || "") !== f.proprietario) return false;
    if (f.categoria !== "all" && String(item.categoria || "") !== f.categoria) return false;
    return true;
  });
  const totalOf = item => Math.max(1, Number(item.quantidadeTotal || 1));

  const demand = new Map();
  const tooLong = days.length >= 3660;
  active.forEach(row => {
    if (tooLong) return;
    const start = row.inicio && row.inicio > periodo.inicio ? row.inicio : periodo.inicio;
    const end = row.fim && row.fim < periodo.fim ? row.fim : periodo.fim;
    if (!demand.has(row.equipamentoId)) demand.set(row.equipamentoId, new Array(days.length).fill(0));
    const series = demand.get(row.equipamentoId);
    for (let i = index.get(start) ?? 0; i <= (index.get(end) ?? -1); i += 1) series[i] += row.quantidade;
  });
  let unitDays = 0;
  const peakByDay = new Array(days.length).fill(0);
  scope.forEach(item => {
    const series = demand.get(String(item.id));
    if (!series) return;
    series.forEach(qty => { unitDays += Math.min(qty, totalOf(item)); });
  });
  demand.forEach(series => series.forEach((qty, i) => { peakByDay[i] += qty; }));
  const capacity = scope.reduce((acc, item) => acc + totalOf(item), 0) * days.length;

  let livres = null;
  if (days.length > 0 && days.length <= MAX_FREE_UNITS_DAYS) {
    const real = scope.filter(item => (data.equipamentos || []).some(e => String(e.id) === String(item.id) && e.ativo !== false));
    const totalUnits = real.reduce((acc, item) => acc + totalOf(item), 0);
    const peak = days.reduce((max, iso) => Math.max(max, real.reduce((acc, item) => acc + disponibilidadeNoDia(data, item, iso).emUso, 0)), 0);
    livres = { unidades: Math.max(0, totalUnits - peak), total: totalUnits };
  }

  const comPendencia = rows.filter(row => !row.cancelada && (row.cobranca.abertoCents > 0));
  return {
    equipamentosLocados: { unidadesNoPico: Math.max(0, ...peakByDay), equipamentos: new Set(active.map(row => row.equipamentoId)).size, locacoes: active.length },
    ocupacao: { pct: capacity > 0 && !tooLong ? (unitDays / capacity) * 100 : null, unidadeDias: unitDays, capacidade: capacity },
    receita: { valor: sum(active, row => row.valorPeriodo), locacoes: active.length },
    aReceber: {
      abertoCents: sum(rows.filter(row => !row.cancelada), row => row.cobranca.abertoCents),
      aFaturarCents: sum(rows.filter(row => !row.cancelada), row => row.cobranca.aFaturarCents),
      locacoesComSaldo: comPendencia.length,
      locacoesAFaturar: rows.filter(row => !row.cancelada && row.cobranca.estado === BILLING_STATE.TO_INVOICE).length,
    },
    livres,
  };
};

// ------------------------------------------------------- ações e permissões ----
export const CHECKPOINT_BY_STATE = Object.freeze({
  ready_for_dispatch: RENTAL_CHECKPOINT_TYPE.SEPARATION, in_transport: RENTAL_CHECKPOINT_TYPE.DISPATCH,
  delivered: RENTAL_CHECKPOINT_TYPE.DELIVERY, returned: RENTAL_CHECKPOINT_TYPE.RETURN, under_inspection: RENTAL_CHECKPOINT_TYPE.INSPECTION,
});
export const CHECKPOINT_LABEL = Object.freeze({
  separation: "Separação", partial_dispatch: "Expedição parcial", dispatch: "Expedição", partial_delivery: "Entrega parcial",
  delivery: "Entrega", partial_return: "Devolução parcial", return: "Devolução", inspection: "Inspeção", adjustment: "Conclusão do ajuste",
});

// Espelho de OPERATIONAL_COMMAND_ROLES (api/data.js) - o servidor continua
// sendo a autoridade; isto só evita oferecer botões que o servidor recusaria.
// server/rental-action-permissions.test.js trava o espelho contra o original.
export const RENTAL_ACTION_ROLES = Object.freeze({
  contrato: ["admin", "engenheiro", "engenheiro_auditor", "financeiro"],
  cobranca: ["admin", "financeiro"],
});

export const canOperateRental = (user, rental, kind) => {
  if (!user?.role || !RENTAL_ACTION_ROLES[kind]?.includes(user.role)) return false;
  return user.role === "admin" || !user.obraId || String(user.obraId) === String(rental?.obraId || "");
};

// Ações disponíveis para uma locação, na ordem em que aparecem no menu e no
// detalhe. As condições são EXATAMENTE as da lista antiga (EquipamentosView):
// só foram movidas para cá para serem testáveis e compartilhadas pela linha e
// pelo painel de detalhe.
export const rentalRowActions = (row, user) => {
  const rental = row.rental;
  const cps = rental.rentalCheckpoints || [];
  const state = row.lifecycleState;
  const contrato = canOperateRental(user, rental, "contrato");
  const cobranca = canOperateRental(user, rental, "cobranca");
  const open = row.emAberto;
  const hasAdjustment = cps.some(item => item.type === RENTAL_CHECKPOINT_TYPE.ADJUSTMENT && item.status !== "cancelled");
  const actions = [];
  const add = (id, label, group, extra = {}) => actions.push({ id, label, group, ...extra });

  if (contrato && open) {
    availableRentalTransitions(state, { checkpoints: cps }).filter(next => !["cancelled", "closed"].includes(next)).forEach(next => {
      const type = CHECKPOINT_BY_STATE[next];
      const recorded = cps.some(item => item.type === type && item.status !== "cancelled");
      add(`avancar:${next}`, type && !recorded ? `Checklist: ${CHECKPOINT_LABEL[type]}` : `Avançar: ${rentalStateLabel(next)}`, "ciclo", { nextState: next });
    });
    if (state === "ready_for_dispatch" && rentalDispatchBalance(rental, cps).remainingQuantity > 1) add("expedicao_parcial", "Expedição parcial", "ciclo");
    if (state === "in_transport" && rentalDeliveryBalance(rental, cps).remainingQuantity > 1) add("entrega_parcial", "Entrega parcial", "ciclo");
    if (state === "awaiting_adjustment" && !hasAdjustment) add("ajuste", "Registrar ajuste concluído", "ciclo");
    if (state === "pickup_requested" && rentalReturnBalance(rental, cps).remainingQuantity > 1) add("devolucao_parcial", "Devolução parcial", "ciclo");
    if (!rental.lifecycleState || state === "under_inspection" || (state === "awaiting_adjustment" && hasAdjustment)) add("encerrar", "Encerrar", "ciclo");
  }
  if (cobranca && !row.cancelada) {
    add("medir", "Medir competência", "cobranca");
    add("cobranca", "Adicionar cobrança", "cobranca");
    if (row.hasItemsToInvoice) add("faturar", "Emitir fatura", "cobranca");
    row.openInvoices.forEach(invoice => add(`receber:${invoice.id}`, `Vincular recebimento · ${invoice.number}`, "cobranca", { invoiceId: invoice.id }));
  }
  if (contrato && !row.cancelada) {
    if (open && ["contracted", "delivered", "active", "pickup_requested"].includes(state)) add("aditivo", "Prorrogar / renovar", "contrato");
    if (open && (rental.equipmentUnitIds || []).length > 0 && ["separating", "ready_for_dispatch", "in_transport", "delivered", "active", "pickup_requested"].includes(state)) add("substituir", "Substituir unidade", "contrato");
    if (!row.cancelada) add("editar", "Editar locação", "contrato");
  }
  if (contrato && !row.cancelada) add("excluir", "Excluir locação", "admin", { danger: true });
  return actions;
};

// A ação principal da linha: só onde "Medir competência" é de fato o próximo
// passo do dia a dia (locação em andamento, perfil financeiro).
export const primaryRowAction = actions => actions.find(item => item.id === "medir") || null;

export const isReadOnlyFor = (row, user) => !canOperateRental(user, row.rental, "contrato") && !canOperateRental(user, row.rental, "cobranca");

// Linha do tempo do detalhe: só junta registros que a locação já guarda.
const CHECKPOINT_TIMELINE_LABEL = CHECKPOINT_LABEL;
export const rentalTimeline = row => {
  const rental = row.rental;
  const events = [];
  if (rental.inicio) events.push({ at: rental.inicio, label: "Início da locação", detail: row.obraRotulo });
  (rental.lifecycleHistory || []).forEach(item => events.push({ at: String(item.at || "").slice(0, 10), label: `Ciclo: ${rentalStateLabel(item.to)}`, detail: [item.actorName, item.reason].filter(Boolean).join(" · ") }));
  (rental.rentalCheckpoints || []).filter(item => item.status !== "cancelled").forEach(item => events.push({ at: String(item.date || item.createdAt || "").slice(0, 10), label: `Checklist: ${CHECKPOINT_TIMELINE_LABEL[item.type] || item.type}`, detail: [item.responsible || item.createdBy, item.quantity ? `${item.quantity} un` : ""].filter(Boolean).join(" · ") }));
  (rental.rentalAmendments || []).forEach(item => events.push({ at: String(item.createdAt || "").slice(0, 10), label: item.type === "renewal" ? "Renovação" : "Prorrogação", detail: [item.newEndDate ? `novo término ${formatDateFull(item.newEndDate)}` : "", item.reason].filter(Boolean).join(" · ") }));
  (rental.rentalReplacements || []).forEach(item => events.push({ at: String(item.date || item.createdAt || "").slice(0, 10), label: "Unidade substituída", detail: item.reason || "" }));
  if (rental.fim && !row.cancelada) events.push({ at: rental.fim, label: "Encerramento", detail: "" });
  if (row.cancelada) events.push({ at: String(rental.cancelledAt || "").slice(0, 10), label: "Locação excluída", detail: rental.cancellationReason || "" });
  return events.sort((a, b) => String(a.at).localeCompare(String(b.at)));
};
