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
import { normalizeRentalState, rentalStateLabel } from "./rental-lifecycle.js";
import { daysBetween, formatDate, isIso, listDays, monthLabel, monthOf, PERIOD_PRESET } from "./rental-period.js";

// Mesmo formato de fmt() em LegacyApp.jsx - a tela inteira fala o mesmo "R$ 1.234,56".
export const formatMoney = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  em_dia: "Em dia", pendente: "Pendente", parcial: "Parcial", a_faturar: "A faturar", sem_medicao: "Sem medição", encerrada: "Ciclo encerrado",
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

    // Dias dentro da janela, pela mesma função dos relatórios. Em "Todo o
    // período" a janela termina hoje: uma locação programada ainda não tem dias.
    const diasNoPeriodo = diasLocacaoNoPeriodo(rental, periodo.inicio, periodo.fim);
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
  // "Fim" = término: a data de fim quando já existe, senão o término planejado.
  fim: row => row.fim || row.plannedEnd || far, valor: row => row.valorPeriodo,
  situacao: row => SITUATION_ORDER.indexOf(row.situacao), cobranca: row => BILLING_ORDER.indexOf(row.cobranca.estado),
};

// Ordenação padrão por aba: histórico = mais recentes primeiro; em andamento =
// quem vence antes aparece antes (o que pede ação primeiro); programadas = a
// que entra primeiro. O usuário sobrescreve clicando no cabeçalho.
export const defaultSortFor = situation => {
  if (situation === RENTAL_SITUATION.ACTIVE) return { key: "fim", dir: "asc" };
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
      faturasComSaldo: comPendencia.reduce((total, row) => total + row.openInvoices.length, 0),
      locacoesAFaturar: rows.filter(row => !row.cancelada && row.cobranca.estado === BILLING_STATE.TO_INVOICE).length,
    },
    livres,
  };
};

// ------------------------------------------- estado da tela -> modelo de tela ----
// A tela guarda UM objeto de estado (`view`); tudo que decide o que aparece
// (chips, escopo, ordenação, agrupamento, página, textos de célula) é
// calculado aqui e o componente só desenha.
export const DEFAULT_SITUATION = "em_andamento";
export const SITUATION_SEGMENTS = [
  { value: "em_andamento", label: "Em andamento", noun: "em andamento" },
  { value: "programada", label: "Programadas", noun: "programadas" },
  { value: "encerrada", label: "Encerradas", noun: "encerradas" },
  { value: "cancelada", label: "Canceladas", noun: "canceladas" },
  { value: "todas", label: "Todas", noun: "" },
];

export const defaultRentalView = ({ hoje, obraIdFixo = "" }) => ({
  periodState: { preset: PERIOD_PRESET.MONTH, ym: monthOf(hoje) },
  filters: { ...DEFAULT_FILTERS, obraId: obraIdFixo || "all" },
  situation: DEFAULT_SITUATION, groupBy: "none", sort: null, page: 0,
});

const isDefaultPeriod = (periodState, hoje) => periodState.preset === PERIOD_PRESET.MONTH && periodState.ym === monthOf(hoje);

// Chips dos filtros ATIVOS (o que difere do padrão). O período só vira chip
// quando sai do mês atual; a situação, quando sai de "Em andamento".
export const buildActiveFilterChips = (view, { periodo, options, hoje, obraIdFixo = "" }) => {
  const { filters, situation, periodState } = view;
  const labelOf = (list, value) => list.find(item => item.value === value)?.label || "—";
  const chips = [];
  if (!isDefaultPeriod(periodState, hoje)) chips.push({ id: "periodo", label: periodo.label });
  if (!obraIdFixo && filters.obraId !== "all") chips.push({ id: "obra", label: labelOf(options.obras, filters.obraId) });
  if (filters.cobranca !== "all") chips.push({ id: "cobranca", label: `Cobrança: ${labelOf(options.cobranca, filters.cobranca)}` });
  if (filters.proprietario !== "all") chips.push({ id: "proprietario", label: `Proprietário: ${labelOf(options.proprietarios, filters.proprietario)}` });
  if (filters.categoria !== "all") chips.push({ id: "categoria", label: `Categoria: ${filters.categoria}` });
  if (normalizeText(filters.busca)) chips.push({ id: "busca", label: `Busca: “${filters.busca.trim()}”` });
  if (situation !== DEFAULT_SITUATION) chips.push({ id: "situacao", label: SITUATION_SEGMENTS.find(item => item.value === situation)?.label || situation });
  return chips;
};

export const clearFilterChip = (view, id, { hoje, obraIdFixo = "" }) => {
  const base = defaultRentalView({ hoje, obraIdFixo });
  if (id === "periodo") return { ...view, periodState: base.periodState, page: 0 };
  if (id === "situacao") return { ...view, situation: base.situation, sort: null, page: 0 };
  const field = { obra: "obraId", cobranca: "cobranca", proprietario: "proprietario", categoria: "categoria", busca: "busca" }[id];
  return field ? { ...view, filters: { ...view.filters, [field]: base.filters[field] }, page: 0 } : view;
};

// "Limpar filtros": devolve filtros, período e situação ao padrão (mantém só o agrupamento).
export const clearRentalView = (view, ctx) => ({ ...defaultRentalView(ctx), groupBy: view.groupBy });

// Legenda de escopo dos indicadores. Eles valem para o recorte (período + filtros)
// em TODAS as situações - a situação é só navegação; por isso a legenda diz isso.
export const rentalScopeLabel = (view, { periodo, options }) => {
  const obra = view.filters.obraId === "all" ? "todas as obras" : options.obras.find(item => item.value === view.filters.obraId)?.label || "obra selecionada";
  const others = activeFilterCount({ ...view.filters, obraId: "all" }) > 0;
  return [periodo.label, obra, "todas as situações", others ? "filtros ativos" : ""].filter(Boolean).join(" · ");
};

// Próximo estado de ordenação ao clicar num cabeçalho: repetir o critério
// inverte o sentido; um critério novo começa por onde faz mais sentido
// (valores e datas: maior/mais recente primeiro; textos: A-Z).
export const nextRentalSort = (current, key) => {
  if (current?.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: ["valor", "inicio", "fim"].includes(key) ? "desc" : "asc" };
};

// Resultado exibido: contagens do recorte, ordenação efetiva, grupos, página e
// as entradas (cabeçalho de grupo ou linha) já na ordem de desenho.
export const buildRentalResults = (context, view, pageSize) => {
  const counts = countBySituation(context);
  const effectiveSort = view.sort || defaultSortFor(view.situation);
  const sorted = sortRentalRows(filterBySituation(context, view.situation), view.sort, view.situation);
  const groups = groupRentalRows(sorted, view.groupBy);
  const ordered = groups ? groups.flatMap(group => group.rows) : sorted;
  const page = paginate(ordered, view.page, pageSize);
  const groupOf = new Map();
  (groups || []).forEach(group => group.rows.forEach(row => groupOf.set(row.id, group)));
  const entries = [];
  let last = null;
  page.items.forEach(row => {
    const group = groupOf.get(row.id);
    if (group && group.key !== last) { entries.push({ type: "group", group }); last = group.key; }
    entries.push({ type: "row", row });
  });
  return { counts, effectiveSort, sorted, summary: summarizeRentalRows(sorted), page, entries, grouped: Boolean(groups) };
};

// ------------------------------------------------------------ textos de célula ----
export const rentalPeriodText = row => `${formatDate(row.inicio)} → ${row.cancelada ? "excluída" : row.fim ? formatDate(row.fim) : "em andamento"}`;

export const vencimentoText = vencimento => {
  if (!vencimento) return "";
  if (vencimento.tipo === "vencida") return `Vencida há ${vencimento.dias} dia(s)`;
  return vencimento.dias === 0 ? "Vence hoje" : `Vence em ${vencimento.dias} dia(s)`;
};

// Valor da célula "Valor no período": o número, ou o motivo de não haver um.
export const rentalValueCell = row => {
  if (row.cancelada) return { kind: "cancelada", amount: null, note: "" };
  if (row.diasNoPeriodo === 0) return { kind: "fora", amount: null, note: row.situacao === "programada" ? `inicia em ${formatDate(row.inicio)}` : "sem dias no período" };
  if (row.semTarifa) return { kind: "sem_tarifa", amount: null, note: "" };
  const composition = row.composicao && !/^\d+ dias?$/.test(row.composicao) ? ` · ${row.composicao}` : "";
  return { kind: "valor", amount: row.valorPeriodo, note: `${row.diasNoPeriodo} dia(s)${composition}` };
};

// Nota sob a cobrança: de onde vem o valor mostrado (fatura emitida x só medido).
export const billingNote = row => {
  if (row.cobranca.abertoCents > 0) return `saldo da fatura ${formatMoney(row.cobranca.abertoCents / 100)}`;
  if (row.cobranca.aFaturarCents > 0) return `medido, sem fatura ${formatMoney(row.cobranca.aFaturarCents / 100)}`;
  return "";
};
