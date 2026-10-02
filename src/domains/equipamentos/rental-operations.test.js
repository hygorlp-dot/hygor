import { describe, expect, it } from "vitest";
import { calcEquipamentosMes } from "./calculations.js";
import {
  BILLING_LABEL, RENTAL_SITUATION_LABEL, SITUATION_SEGMENTS, billingNote, buildActiveFilterChips, buildRentalResults, clearFilterChip,
  clearRentalView, defaultRentalView, nextRentalSort, rentalPeriodText, rentalScopeLabel, rentalValueCell, vencimentoText,
  applyRentalFilters, buildFilterOptions, buildRentalRows, computeRentalKpis, countBySituation, DEFAULT_FILTERS,
  activeFilterCount, filterBySituation, groupRentalRows, NO_WORK, paginate, rentalSituation, sortRentalRows,
  summarizeRentalRows, defaultSortFor,
} from "./rental-operations.js";
import { resolveRentalPeriod } from "./rental-period.js";
import { buildRentalData, HOJE } from "./rental-operations.fixture.js";

const SETEMBRO = { preset: "mes", ym: "2026-09" };
const context = (data, periodState = SETEMBRO, filters = DEFAULT_FILTERS) => {
  const periodo = resolveRentalPeriod(periodState, { hoje: HOJE, rentals: data.locacoesEquip });
  const rows = buildRentalRows(data, { periodo, hoje: HOJE });
  return { periodo, rows, filtered: applyRentalFilters(rows, filters, periodo) };
};
const ids = rows => rows.map(row => row.id).sort();
const admin = { id: "u1", role: "admin" };
const financeiro = { id: "u2", role: "financeiro" };

describe("situação e vencimento", () => {
  it("classifica por data e status, sem reinterpretar o registro", () => {
    expect(rentalSituation({ status: "cancelada", inicio: "2026-09-01" }, HOJE)).toBe("cancelada");
    expect(rentalSituation({ status: "ativa", inicio: "2026-09-20" }, HOJE)).toBe("programada");
    expect(rentalSituation({ status: "ativa", inicio: "2026-08-01", fim: "2026-09-05" }, HOJE)).toBe("encerrada");
    expect(rentalSituation({ status: "ativa", inicio: "2026-08-01", fim: "2026-09-30" }, HOJE)).toBe("em_andamento");
    expect(rentalSituation({ status: "ativa", inicio: "2026-08-01", fim: "" }, HOJE)).toBe("em_andamento");
  });

  it("marca locações em andamento que vencem em até 7 dias ou já venceram", () => {
    const data = buildRentalData();
    data.locacoesEquip.push({ id: "L8", equipamentoId: "eq-bet", obraId: "ob-a", inicio: "2026-08-01", fim: "", plannedEndDate: "2026-09-10", quantidade: 1, status: "ativa" });
    const { rows } = context(data);
    expect(rows.find(row => row.id === "L1").vencimento).toEqual({ tipo: "vence", dias: 3 });
    expect(rows.find(row => row.id === "L8").vencimento).toEqual({ tipo: "vencida", dias: 5 });
    expect(rows.find(row => row.id === "L7").vencimento).toBeNull();
  });
});

describe("cobrança por locação", () => {
  it("deriva o estado dos registros que os comandos já gravam", () => {
    const { rows } = context(buildRentalData());
    const state = id => rows.find(row => row.id === id).cobranca.estado;
    expect(state("L1")).toBe("a_faturar");
    expect(state("L2")).toBe("encerrada");
    expect(state("L3")).toBe("sem_medicao");
    expect(state("L5")).toBe("encerrada"); // cancelada: nada mais a cobrar
    expect(state("L6")).toBe("parcial");
    expect(state("L7")).toBe("pendente");
  });

  it("fatura quitada em locação ainda em andamento é 'em dia'", () => {
    const data = buildRentalData();
    data.rentalInvoices.push({ id: "inv-L1", rentalId: "L1", workId: "ob-a", number: "FAT-1", status: "paid", netAmountCents: 100, receivedAmountCents: 100, openAmountCents: 0 });
    data.rentalChargeItems = data.rentalChargeItems.map(item => item.rentalId === "L1" ? { ...item, status: "billed" } : item);
    expect(context(data).rows.find(row => row.id === "L1").cobranca.estado).toBe("em_dia");
  });
});

describe("valores e consistência com o motor existente", () => {
  it("a soma do período bate com calcEquipamentosMes (mesma regra de cobrança)", () => {
    const data = buildRentalData();
    const { rows } = context(data);
    const total = rows.filter(row => !row.cancelada).reduce((acc, row) => acc + row.valorPeriodo, 0);
    expect(total).toBeCloseTo(calcEquipamentosMes(data, "2026-09").total.receita, 2);
    expect(total).toBeCloseTo(8380, 2); // 1500 + 200 + 2200 + 4200 + 280
  });

  it("mês diferente muda o recorte sem alterar a locação nem o valor acumulado", () => {
    const data = buildRentalData();
    const setembro = context(data).rows.find(row => row.id === "L2");
    const agosto = context(data, { preset: "mes", ym: "2026-08" }).rows.find(row => row.id === "L2");
    expect(agosto.valorPeriodo).toBeCloseTo(10 * 22 * 4, 2); // 10..31/08 = 22 dias
    expect(setembro.valorPeriodo).toBeCloseTo(10 * 5 * 4, 2);
    expect(agosto.valorAcumulado).toBe(setembro.valorAcumulado);
    expect(agosto.rental).toEqual(setembro.rental);
  });

  it("locação cancelada não gera valor", () => {
    expect(context(buildRentalData()).rows.find(row => row.id === "L5")).toMatchObject({ valorPeriodo: 0, cancelada: true });
  });

  it("sem tarifa fica explícito em vez de R$ 0 silencioso", () => {
    const data = buildRentalData();
    data.equipamentos[0].tarifas = {};
    expect(context(data).rows.find(row => row.id === "L1").semTarifa).toBe(true);
  });
});

describe("filtros", () => {
  const data = buildRentalData();

  it("o período decide quais locações aparecem", () => {
    expect(ids(context(data).filtered)).toEqual(["L1", "L2", "L3", "L5", "L6", "L7"]);
    expect(ids(context(data, { preset: "mes", ym: "2026-07" }).filtered)).toEqual(["L4"]);
    expect(ids(context(data, { preset: "tudo" }).filtered)).toEqual(["L1", "L2", "L3", "L4", "L5", "L6", "L7"]);
    expect(ids(context(data, { preset: "hoje" }).filtered)).toEqual(["L1", "L5", "L6", "L7"]);
  });

  it("filtra por obra, incluindo locações sem obra", () => {
    expect(ids(context(data, SETEMBRO, { ...DEFAULT_FILTERS, obraId: "ob-b" }).filtered)).toEqual(["L2", "L6"]);
    const semObra = buildRentalData();
    semObra.locacoesEquip.push({ id: "L9", equipamentoId: "eq-ger", obraId: "", inicio: "2026-09-01", fim: "", quantidade: 1, status: "ativa" });
    expect(ids(context(semObra, SETEMBRO, { ...DEFAULT_FILTERS, obraId: NO_WORK }).filtered)).toEqual(["L9"]);
  });

  it("filtra por cobrança, proprietário e categoria", () => {
    expect(ids(context(data, SETEMBRO, { ...DEFAULT_FILTERS, cobranca: "pendente" }).filtered)).toEqual(["L7"]);
    expect(ids(context(data, SETEMBRO, { ...DEFAULT_FILTERS, proprietario: "terceiros" }).filtered)).toEqual(["L2", "L5", "L7"]);
    expect(ids(context(data, SETEMBRO, { ...DEFAULT_FILTERS, proprietario: "proprio" }).filtered)).toEqual(["L1", "L3", "L6"]);
    expect(ids(context(data, SETEMBRO, { ...DEFAULT_FILTERS, proprietario: "own-1" }).filtered)).toEqual(["L2", "L5", "L7"]);
    expect(ids(context(data, SETEMBRO, { ...DEFAULT_FILTERS, categoria: "Energia" }).filtered)).toEqual(["L3", "L6"]);
  });

  it("busca por equipamento, patrimônio, obra (nome e código), proprietário e fatura - sem acento e sem caixa", () => {
    const search = busca => ids(context(data, SETEMBRO, { ...DEFAULT_FILTERS, busca }).filtered);
    expect(search("betoneira")).toEqual(["L1"]);
    expect(search("EQ-051")).toEqual(["L3", "L6"]);
    expect(search("oasis")).toEqual(["L2", "L6"]); // "Oásis" sem acento
    expect(search("k1-04")).toEqual(["L1", "L3", "L5", "L7"]);
    expect(search("locadora norte")).toEqual(["L2", "L5", "L7"]);
    expect(search("FAT-202609-003")).toEqual(["L7"]);
    expect(search("nada disso existe")).toEqual([]);
  });

  it("combina vários filtros e conta os ativos para o botão 'Limpar filtros'", () => {
    const filters = { ...DEFAULT_FILTERS, obraId: "ob-a", proprietario: "terceiros", busca: "andaime" };
    expect(ids(context(data, SETEMBRO, filters).filtered)).toEqual(["L5", "L7"]);
    expect(activeFilterCount(filters)).toBe(3);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, busca: "   " })).toBe(0);
    expect(ids(context(data, SETEMBRO, DEFAULT_FILTERS).filtered)).toEqual(["L1", "L2", "L3", "L5", "L6", "L7"]);
  });

  it("opções de filtro vêm dos dados: obra com código e nome, proprietários e categorias", () => {
    const { rows } = context(data, { preset: "tudo" });
    const options = buildFilterOptions(data, rows);
    expect(options.obras.map(opt => opt.label)).toEqual(["Todas as obras", "K1-04 — Terras Alpha", "P1-08 — Oásis Home Park"]);
    expect(options.proprietarios.map(opt => opt.label)).toEqual(["Todos", "ARCD (próprio)", "Terceiros", "Locadora Norte"]);
    expect(options.categorias.map(opt => opt.label)).toEqual(["Todas", "Acesso", "Concreto", "Energia"]);
    expect(options.obras.some(opt => opt.value === NO_WORK)).toBe(false);
  });
});

describe("situação como navegação", () => {
  it("as contagens refletem o contexto (período + filtros), não o histórico inteiro", () => {
    const data = buildRentalData();
    expect(countBySituation(context(data).filtered)).toEqual({ todas: 6, em_andamento: 3, programada: 1, encerrada: 1, cancelada: 1 });
    expect(countBySituation(context(data, SETEMBRO, { ...DEFAULT_FILTERS, obraId: "ob-b" }).filtered)).toEqual({ todas: 2, em_andamento: 1, programada: 0, encerrada: 1, cancelada: 0 });
    const { filtered } = context(data);
    expect(ids(filterBySituation(filtered, "em_andamento"))).toEqual(["L1", "L6", "L7"]);
    expect(ids(filterBySituation(filtered, "encerrada"))).toEqual(["L2"]);
    expect(filterBySituation(filtered, "todas")).toHaveLength(6);
  });
});

describe("ordenação", () => {
  const { filtered } = context(buildRentalData());
  it("padrão por aba: em andamento = quem vence primeiro; histórico = mais recentes primeiro", () => {
    expect(defaultSortFor("em_andamento")).toEqual({ key: "fim", dir: "asc" });
    expect(sortRentalRows(filterBySituation(filtered, "em_andamento"), null, "em_andamento").map(row => row.id)).toEqual(["L1", "L7", "L6"]); // L7 e L6 sem término planejado: desempate por nome
    expect(sortRentalRows(filtered, null, "todas").map(row => row.id)).toEqual(["L3", "L6", "L7", "L5", "L1", "L2"]);
  });

  it("ordena por valor, obra, equipamento, fim, situação e cobrança nos dois sentidos", () => {
    const by = (key, dir) => sortRentalRows(filtered, { key, dir }).map(row => row.id);
    expect(by("valor", "desc")[0]).toBe("L6");
    expect(by("valor", "asc")[0]).toBe("L5");
    expect(by("equipamento", "asc").slice(0, 3)).toEqual(["L2", "L5", "L7"]); // "Andaime tubular", desempate por id
    expect(by("obra", "asc").slice(0, 4).sort()).toEqual(["L1", "L3", "L5", "L7"]); // K1-04 vem antes de P1-08
    expect(by("fim", "asc")[0]).toBe("L2");
    expect(by("situacao", "asc")[0]).not.toBe("L5");
    expect(by("cobranca", "asc")[0]).toBe("L7"); // pendente é o mais urgente
  });
});

describe("agrupamento e resumo", () => {
  it("agrupa por obra com contagem e total do período de cada grupo", () => {
    const { filtered } = context(buildRentalData());
    const groups = groupRentalRows(sortRentalRows(filtered, null, "todas"), "obra");
    expect(groups.map(group => group.label)).toEqual(["K1-04 — Terras Alpha", "P1-08 — Oásis Home Park"]);
    expect(groups[0]).toMatchObject({ count: 4 });
    expect(groups[0].valor).toBeCloseTo(1500 + 2200 + 280, 2);
    expect(groups[1].valor).toBeCloseTo(200 + 4200, 2);
    expect(groupRentalRows(filtered, "none")).toBeNull();
    expect(groupRentalRows(filtered, "situacao").map(group => group.key)).toEqual(["em_andamento", "programada", "encerrada", "cancelada"]);
    expect(groupRentalRows(filtered, "mes").map(group => group.key)).toEqual(["2026-09", "2026-08"]);
    expect(groupRentalRows(filtered, "proprietario").map(group => group.label)).toEqual(["ARCD (próprio)", "Locadora Norte"]);
  });

  it("resume locações, obras e valor do que está filtrado", () => {
    const { filtered } = context(buildRentalData());
    expect(summarizeRentalRows(filtered)).toMatchObject({ locacoes: 6, obras: 2, equipamentos: 3 });
    expect(summarizeRentalRows(filtered).valor).toBeCloseTo(8380, 2);
    expect(summarizeRentalRows([])).toMatchObject({ locacoes: 0, obras: 0, valor: 0 });
  });

  it("pagina sem perder filtros e limita a página fora do intervalo", () => {
    const items = Array.from({ length: 53 }, (_, index) => index);
    expect(paginate(items, 0, 25)).toMatchObject({ pageCount: 3, from: 1, to: 25, total: 53 });
    expect(paginate(items, 2, 25)).toMatchObject({ from: 51, to: 53 });
    expect(paginate(items, 99, 25).page).toBe(2);
    expect(paginate([], 0, 25)).toMatchObject({ from: 0, to: 0, pageCount: 1 });
  });
});

describe("KPIs respondem ao período e aos filtros", () => {
  it("setembro, todas as obras", () => {
    const data = buildRentalData();
    const { periodo, filtered } = context(data);
    const kpis = computeRentalKpis(data, filtered, periodo);
    expect(kpis.receita.valor).toBeCloseTo(8380, 2);
    expect(kpis.equipamentosLocados).toEqual({ unidadesNoPico: 6, equipamentos: 3, locacoes: 5 });
    expect(kpis.ocupacao.unidadeDias).toBe(99);
    expect(kpis.ocupacao.capacidade).toBe(360);
    expect(kpis.ocupacao.pct).toBeCloseTo(27.5, 5);
    expect(kpis.aReceber).toEqual({ abertoCents: 88000, aFaturarCents: 150000, locacoesComSaldo: 2, faturasComSaldo: 2, locacoesAFaturar: 1 });
    expect(kpis.livres.total).toBe(12);
    expect(kpis.livres.unidades).toBe(6);
  });

  it("trocar o período atualiza os indicadores", () => {
    const data = buildRentalData();
    const julho = context(data, { preset: "mes", ym: "2026-07" });
    const kpis = computeRentalKpis(data, julho.filtered, julho.periodo);
    expect(kpis.receita.valor).toBeCloseTo(1600, 2); // 31 dias = 1 mês (1500) + 1 diária (100)
    expect(kpis.equipamentosLocados.locacoes).toBe(1);
    expect(kpis.aReceber.abertoCents).toBe(0);
  });

  it("filtrar por obra restringe receita, locações e saldos ao que é daquela obra", () => {
    const data = buildRentalData();
    const filters = { ...DEFAULT_FILTERS, obraId: "ob-b" };
    const { periodo, filtered } = context(data, SETEMBRO, filters);
    const kpis = computeRentalKpis(data, filtered, periodo, filters);
    expect(kpis.receita.valor).toBeCloseTo(200 + 4200, 2);
    expect(kpis.aReceber.abertoCents).toBe(60000);
    expect(kpis.aReceber.aFaturarCents).toBe(0);
    expect(kpis.equipamentosLocados.locacoes).toBe(2);
  });

  it("filtro de proprietário restringe também a frota usada como base da ocupação", () => {
    const data = buildRentalData();
    const filters = { ...DEFAULT_FILTERS, proprietario: "terceiros" };
    const { periodo, filtered } = context(data, SETEMBRO, filters);
    const kpis = computeRentalKpis(data, filtered, periodo, filters);
    expect(kpis.ocupacao.capacidade).toBe(10 * 30); // só o andaime (10 un.)
    expect(kpis.ocupacao.unidadeDias).toBe(48);
  });

  it("'livres' não é calculado para períodos longos", () => {
    const data = buildRentalData();
    const { periodo, filtered } = context(data, { preset: "personalizado", inicio: "2026-01-01", fim: "2026-09-15" });
    expect(computeRentalKpis(data, filtered, periodo).livres).toBeNull();
  });

  it("sem locações o painel não quebra", () => {
    const data = { ...buildRentalData(), locacoesEquip: [], rentalChargeItems: [], rentalInvoices: [] };
    const { periodo, filtered } = context(data);
    const kpis = computeRentalKpis(data, filtered, periodo);
    expect(kpis.receita.valor).toBe(0);
    expect(kpis.ocupacao.pct).toBe(0);
    expect(kpis.equipamentosLocados.unidadesNoPico).toBe(0);
  });
});

describe("vocabulário: situação da locação x situação da cobrança", () => {
  it("nenhum rótulo é igual nas duas colunas (nem na aba de situação e no filtro de cobrança)", () => {
    const situation = Object.values(RENTAL_SITUATION_LABEL).map(label => label.toLowerCase());
    const billing = Object.values(BILLING_LABEL).map(label => label.toLowerCase());
    expect(situation.filter(label => billing.includes(label))).toEqual([]);
    const segments = SITUATION_SEGMENTS.map(item => item.label.toLowerCase());
    expect(segments.filter(label => billing.includes(label))).toEqual([]);
  });

  it("o ciclo financeiro encerrado se chama 'Ciclo encerrado'; a locação encerrada, 'Encerrada'", () => {
    const { rows } = context(buildRentalData());
    const l2 = rows.find(row => row.id === "L2");
    expect(RENTAL_SITUATION_LABEL[l2.situacao]).toBe("Encerrada");
    expect(l2.cobranca.label).toBe("Ciclo encerrado");
    expect(buildFilterOptions(buildRentalData(), rows).cobranca.map(item => item.label)).toEqual(
      ["Todas", "Pendente", "Parcial", "A faturar", "Sem medição", "Em dia", "Ciclo encerrado"]);
  });
});

describe("'Todo o período'", () => {
  const withHistory = () => {
    const data = buildRentalData();
    data.locacoesEquip.push(
      { id: "OLD", equipamentoId: "eq-bet", obraId: "ob-b", inicio: "2025-01-10", fim: "2025-01-31", quantidade: 1, status: "ativa", version: 1 },
      { id: "OPEN-OLD", equipamentoId: "eq-ger", obraId: "ob-a", inicio: "2025-03-01", fim: "", quantidade: 1, status: "ativa", version: 1 },
    );
    return data;
  };

  it("inclui locações muito antigas, atuais, programadas e encerradas, cada uma com seu valor", () => {
    const { filtered, periodo } = context(withHistory(), { preset: "tudo" });
    expect(periodo).toMatchObject({ inicio: "2025-01-10", fim: "2026-09-15", label: "Todo o período" });
    expect(ids(filtered)).toEqual(["L1", "L2", "L3", "L4", "L5", "L6", "L7", "OLD", "OPEN-OLD"]);
    const row = id => filtered.find(item => item.id === id);
    expect(row("OLD").valorPeriodo).toBeCloseTo(1500, 2); // 22 dias: 1 mês (R$ 1.500) é mais barato que 3 semanas + 1 diária
    expect(row("OPEN-OLD").diasNoPeriodo).toBeGreaterThan(500); // aberta desde 2025, corre até hoje
    // programada: ainda sem dias, sem valor - a célula explica em vez de mostrar R$ 0,00
    expect(row("L3").diasNoPeriodo).toBe(0);
    expect(rentalValueCell(row("L3"))).toEqual({ kind: "fora", amount: null, note: "inicia em 20/09/26" });
    expect(countBySituation(filtered)).toMatchObject({ programada: 1, cancelada: 1 });
  });

  it("os indicadores do período inteiro não contam locação que ainda não começou", () => {
    const data = withHistory();
    const { filtered, periodo } = context(data, { preset: "tudo" });
    const kpis = computeRentalKpis(data, filtered, periodo);
    expect(kpis.equipamentosLocados.locacoes).toBe(filtered.filter(row => !row.cancelada && row.diasNoPeriodo > 0).length);
    expect(kpis.receita.valor).toBeCloseTo(filtered.filter(row => !row.cancelada).reduce((total, row) => total + row.valorPeriodo, 0), 2);
  });
});

describe("modelo de tela (estado -> domínio -> view model)", () => {
  const ctxFor = view => {
    const periodo = resolveRentalPeriod(view.periodState, { hoje: HOJE });
    const data = buildRentalData();
    const rows = buildRentalRows(data, { periodo, hoje: HOJE });
    return { periodo, data, rows, options: buildFilterOptions(data, rows), ctx: { hoje: HOJE, obraIdFixo: "" } };
  };

  it("estado padrão: mês atual, em andamento, sem filtros e sem chips", () => {
    const view = defaultRentalView({ hoje: HOJE });
    expect(view).toMatchObject({ situation: "em_andamento", groupBy: "none", sort: null, page: 0, filters: DEFAULT_FILTERS });
    const { periodo, options } = ctxFor(view);
    expect(buildActiveFilterChips(view, { periodo, options, hoje: HOJE })).toEqual([]);
  });

  it("chips refletem exatamente o que difere do padrão, e cada um se remove sozinho", () => {
    let view = { ...defaultRentalView({ hoje: HOJE }), situation: "encerrada" };
    view = { ...view, periodState: { preset: "tudo" }, filters: { ...view.filters, obraId: "ob-a", cobranca: "pendente", busca: " andaime " } };
    const { periodo, options } = ctxFor(view);
    const chips = buildActiveFilterChips(view, { periodo, options, hoje: HOJE });
    expect(chips.map(chip => chip.label)).toEqual(["Todo o período", "K1-04 — Terras Alpha", "Cobrança: Pendente", "Busca: “andaime”", "Encerradas"]);
    const ctx = { hoje: HOJE };
    expect(clearFilterChip(view, "obra", ctx).filters.obraId).toBe("all");
    expect(clearFilterChip(view, "periodo", ctx).periodState).toEqual({ preset: "mes", ym: "2026-09" });
    expect(clearFilterChip(view, "situacao", ctx).situation).toBe("em_andamento");
    // limpar um não mexe nos demais
    expect(clearFilterChip(view, "obra", ctx).filters.cobranca).toBe("pendente");
    expect(clearRentalView({ ...view, groupBy: "obra" }, ctx)).toEqual({ ...defaultRentalView(ctx), groupBy: "obra" });
  });

  it("trocar outro filtro não devolve o período ao mês atual", () => {
    const view = { ...defaultRentalView({ hoje: HOJE }), periodState: { preset: "tudo" } };
    const cleared = clearFilterChip({ ...view, filters: { ...view.filters, obraId: "ob-a" } }, "obra", { hoje: HOJE });
    expect(cleared.periodState).toEqual({ preset: "tudo" });
  });

  it("legenda de escopo: nomeia período, obra e situações; sem mês quando é 'Todo o período'", () => {
    const base = defaultRentalView({ hoje: HOJE });
    const mk = view => { const { periodo, options } = ctxFor(view); return rentalScopeLabel(view, { periodo, options }); };
    expect(mk(base)).toBe("Setembro 2026 · todas as obras · todas as situações");
    expect(mk({ ...base, filters: { ...base.filters, obraId: "ob-a" } })).toBe("Setembro 2026 · K1-04 — Terras Alpha · todas as situações");
    const all = mk({ ...base, periodState: { preset: "tudo" } });
    expect(all).toBe("Todo o período · todas as obras · todas as situações");
    expect(all).not.toMatch(/Setembro|2026 ·/);
    expect(mk({ ...base, filters: { ...base.filters, cobranca: "pendente" } })).toMatch(/filtros ativos$/);
  });

  it("ordenação: repetir o critério inverte; critério novo começa pelo sentido útil", () => {
    expect(nextRentalSort({ key: "valor", dir: "desc" }, "valor")).toEqual({ key: "valor", dir: "asc" });
    expect(nextRentalSort({ key: "valor", dir: "asc" }, "obra")).toEqual({ key: "obra", dir: "asc" });
    expect(nextRentalSort(null, "inicio")).toEqual({ key: "inicio", dir: "desc" });
  });

  it("resultados: contagens do recorte, situação escolhida, grupos contíguos e página com cabeçalhos", () => {
    const view = { ...defaultRentalView({ hoje: HOJE }), situation: "todas", groupBy: "obra" };
    const { filtered } = context(buildRentalData());
    const results = buildRentalResults(filtered, view, 4);
    expect(results.counts.todas).toBe(6);
    expect(results.page).toMatchObject({ total: 6, pageCount: 2, from: 1, to: 4 });
    expect(results.entries.map(entry => entry.type)).toEqual(["group", "row", "row", "row", "row"]);
    const second = buildRentalResults(filtered, { ...view, page: 1 }, 4);
    expect(second.entries.map(entry => entry.type)).toEqual(["group", "row", "row"]); // o 2º grupo abre na página 2
    expect(second.grouped).toBe(true);
    expect(buildRentalResults(filtered, { ...view, groupBy: "none" }, 25).entries.every(entry => entry.type === "row")).toBe(true);
  });

  it("textos de célula vêm do domínio", () => {
    const { rows } = context(buildRentalData());
    const l1 = rows.find(row => row.id === "L1");
    expect(rentalPeriodText(l1)).toBe("01/09/26 → em andamento");
    expect(vencimentoText(l1.vencimento)).toBe("Vence em 3 dia(s)");
    expect(vencimentoText({ tipo: "vencida", dias: 2 })).toBe("Vencida há 2 dia(s)");
    expect(billingNote(l1)).toBe(`medido, sem fatura ${(1500).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
    expect(billingNote(rows.find(row => row.id === "L7"))).toMatch(/^saldo da fatura R\$/);
    expect(rentalValueCell(rows.find(row => row.id === "L5"))).toMatchObject({ kind: "cancelada" });
    expect(rentalValueCell(l1)).toMatchObject({ kind: "valor", note: "30 dia(s) · 1 mês" });
  });
});
