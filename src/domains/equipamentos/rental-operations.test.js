import { describe, expect, it } from "vitest";
import { calcEquipamentosMes } from "./calculations.js";
import {
  applyRentalFilters, buildFilterOptions, buildRentalRows, computeRentalKpis, countBySituation, DEFAULT_FILTERS,
  activeFilterCount, filterBySituation, groupRentalRows, NO_WORK, paginate, periodSelectOptions, periodSelectValue,
  periodStateFromSelect, rentalRowActions, rentalSituation, rentalTimeline, resolveRentalPeriod, shiftMonth, sortRentalRows,
  summarizeRentalRows, canOperateRental, primaryRowAction, isReadOnlyFor, defaultSortFor,
} from "./rental-operations.js";
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

describe("período", () => {
  it("resolve os atalhos a partir de 'hoje' fixo (terça 15/09/2026)", () => {
    expect(resolveRentalPeriod({ preset: "hoje" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-15", fim: "2026-09-15" });
    expect(resolveRentalPeriod({ preset: "semana" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-14", fim: "2026-09-20" });
    expect(resolveRentalPeriod({ preset: "30d" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-08-17", fim: "2026-09-15" });
    expect(resolveRentalPeriod(SETEMBRO, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-30", label: "Setembro 2026", mensal: true });
  });

  it("semana que começa no domingo recua até a segunda anterior", () => {
    expect(resolveRentalPeriod({ preset: "semana" }, { hoje: "2026-09-20" })).toMatchObject({ inicio: "2026-09-14", fim: "2026-09-20" });
    expect(resolveRentalPeriod({ preset: "semana" }, { hoje: "2026-09-21" })).toMatchObject({ inicio: "2026-09-21", fim: "2026-09-27" });
  });

  it("navegação mensal atravessa o ano e 'mês anterior' é o mesmo preset com outro mês", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(periodStateFromSelect("mes_anterior", HOJE)).toEqual({ preset: "mes", ym: "2026-08" });
    expect(periodSelectValue({ preset: "mes", ym: "2026-09" }, HOJE)).toBe("mes");
    expect(periodSelectValue({ preset: "mes", ym: "2026-08" }, HOJE)).toBe("mes_anterior");
    expect(periodSelectValue({ preset: "mes", ym: "2026-03" }, HOJE)).toBe("mes:2026-03");
    expect(periodSelectOptions({ preset: "mes", ym: "2026-03" }, HOJE).some(opt => opt.value === "mes:2026-03" && opt.label === "Março 2026")).toBe(true);
    expect(periodSelectOptions(SETEMBRO, HOJE).some(opt => opt.value.startsWith("mes:"))).toBe(false);
  });

  it("período personalizado inverte datas trocadas e cai no mês atual quando incompleto", () => {
    expect(resolveRentalPeriod({ preset: "personalizado", inicio: "2026-09-10", fim: "2026-09-01" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-10" });
    expect(resolveRentalPeriod({ preset: "personalizado", inicio: "", fim: "" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-30", incompleto: true });
  });

  it("'todo o período' cobre da locação mais antiga até hoje", () => {
    const data = buildRentalData();
    expect(resolveRentalPeriod({ preset: "tudo" }, { hoje: HOJE, rentals: data.locacoesEquip })).toMatchObject({ inicio: "2026-07-01", fim: "2026-09-15" });
  });
});

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
    expect(defaultSortFor("em_andamento")).toEqual({ key: "vencimento", dir: "asc" });
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
    expect(kpis.aReceber).toEqual({ abertoCents: 88000, aFaturarCents: 150000, locacoesComSaldo: 2, locacoesAFaturar: 1 });
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

describe("ações da linha e permissões", () => {
  const rowOf = (id, data = buildRentalData()) => context(data, { preset: "tudo" }).rows.find(row => row.id === id);
  const labels = (row, user) => rentalRowActions(row, user).map(action => action.label);

  it("administrador vê todas as ações aplicáveis; a ação principal é 'Medir competência'", () => {
    const actions = rentalRowActions(rowOf("L1"), admin);
    expect(actions.map(action => action.id)).toEqual(expect.arrayContaining(["avancar:pickup_requested", "medir", "cobranca", "faturar", "aditivo", "editar", "excluir"]));
    expect(primaryRowAction(actions)?.id).toBe("medir");
    expect(actions.find(action => action.id === "excluir")).toMatchObject({ danger: true, group: "admin" });
    expect(actions.filter(action => action.danger)).toHaveLength(1);
  });

  it("locação cancelada não oferece ação alguma de alteração", () => {
    expect(rentalRowActions(rowOf("L5"), admin)).toEqual([]);
  });

  it("locação encerrada só mantém cobrança (medir/cobrança) e vínculo de recebimento", () => {
    const encerrada = labels(rowOf("L2"), admin);
    expect(encerrada).toEqual(expect.arrayContaining(["Medir competência", "Adicionar cobrança", "Editar locação", "Excluir locação"]));
    expect(encerrada).not.toContain("Prorrogar / renovar");
  });

  it("lista 'vincular recebimento' para cada fatura com saldo", () => {
    expect(labels(rowOf("L6"), financeiro)).toContain("Vincular recebimento · FAT-202609-002");
    expect(labels(rowOf("L2"), financeiro).some(label => label.startsWith("Vincular recebimento"))).toBe(false);
  });

  it("financeiro altera cobrança e contrato; engenheiro só contrato; outros perfis só consultam", () => {
    const eng = { id: "u3", role: "engenheiro" };
    expect(labels(rowOf("L1"), eng)).toEqual(expect.arrayContaining(["Editar locação", "Excluir locação"]));
    expect(labels(rowOf("L1"), eng)).not.toContain("Medir competência");
    expect(labels(rowOf("L1"), { role: "rh" })).toEqual([]);
    expect(labels(rowOf("L1"), null)).toEqual([]);
    expect(isReadOnlyFor(rowOf("L1"), { role: "rh" })).toBe(true);
    expect(isReadOnlyFor(rowOf("L1"), eng)).toBe(false);
  });

  it("perfil vinculado a uma obra só age nas locações da própria obra", () => {
    const daObraA = { id: "u4", role: "financeiro", obraId: "ob-a" };
    expect(canOperateRental(daObraA, rowOf("L1").rental, "cobranca")).toBe(true);
    expect(canOperateRental(daObraA, rowOf("L6").rental, "cobranca")).toBe(false);
    expect(labels(rowOf("L6"), daObraA)).toEqual([]);
  });

  it("não oferece o que o ciclo de vida não permite (condições idênticas às da lista antiga)", () => {
    const data = buildRentalData();
    data.locacoesEquip[0].lifecycleState = "ready_for_dispatch";
    data.locacoesEquip[0].quantidade = 3;
    expect(labels(rowOf("L1", data), admin)).toEqual(expect.arrayContaining(["Checklist: Expedição", "Expedição parcial"]));
    expect(labels(rowOf("L1", data), admin)).not.toContain("Prorrogar / renovar");
    expect(labels(rowOf("L1", data), admin)).not.toContain("Encerrar");
  });

  it("registro legado (sem ciclo de vida) em aberto pode ser encerrado", () => {
    expect(labels(rowOf("L7"), admin)).toContain("Encerrar");
  });
});

describe("linha do tempo do detalhe", () => {
  it("junta início, ciclo, checklists, aditivos e encerramento em ordem cronológica", () => {
    const data = buildRentalData();
    Object.assign(data.locacoesEquip[0], {
      lifecycleHistory: [{ at: "2026-09-02T10:00:00Z", to: "delivered", actorName: "Ana" }],
      rentalCheckpoints: [{ type: "delivery", status: "recorded", date: "2026-09-02", responsible: "Ana", quantity: 1 }],
      rentalAmendments: [{ type: "extension", newEndDate: "2026-09-18", reason: "Obra atrasou", createdAt: "2026-09-10T09:00:00Z" }],
    });
    const row = context(data).rows.find(item => item.id === "L1");
    const labels = rentalTimeline(row).map(item => item.label);
    expect(labels).toEqual(["Início da locação", "Ciclo: Entregue", "Checklist: Entrega", "Prorrogação"]);
    expect(rentalTimeline(context(data).rows.find(item => item.id === "L5")).at(-1)).toMatchObject({ label: "Locação excluída", detail: "Pedido duplicado" });
  });
});
