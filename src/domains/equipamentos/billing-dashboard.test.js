import { describe, expect, it } from "vitest";
import { calcEquipamentosMes, calcEquipamentosPorObra, calcEquipFaturamentoEmpresa } from "./calculations.js";
import {
  activeBillingFilterCount, billingScopeLabel, buildBillingChips, buildBillingDashboard, buildBillingFilterOptions,
  buildWorkMemory, DEFAULT_BILLING_FILTERS, PENDING_TYPE, sortWorks, workResultBars,
} from "./billing-dashboard.js";
import { BILLING_HOJE, BILLING_YM, buildBillingData } from "./billing-dashboard.fixture.js";

const owner = () => "Locadora Norte";
const build = (filters = {}, ym = BILLING_YM, data = buildBillingData()) =>
  buildBillingDashboard(data, { ym, hoje: BILLING_HOJE, filters: { ...DEFAULT_BILLING_FILTERS, ...filters }, ownerName: owner });
const ids = model => model.rows.map(row => row.locacaoId).sort();

describe("equação financeira: receita contratual - descontos = líquida - custos = resultado", () => {
  it("sem filtro, os totais são os de calcEquipamentosMes (autoridade do DRE de equipamentos)", () => {
    const data = buildBillingData();
    const model = build({}, BILLING_YM, data);
    const authority = calcEquipFaturamentoEmpresa(data, BILLING_YM);
    expect(model.unfiltered).toBe(true);
    expect(model.finance.receitaContratual).toBeCloseTo(authority.receitaBruta, 2);
    expect(model.finance.descontos).toBeCloseTo(authority.descontos, 2);
    expect(model.finance.receitaLiquida).toBeCloseTo(authority.receita, 2);
    expect(model.finance.repasses).toBeCloseTo(authority.custoDono, 2);
    expect(model.finance.manutencao).toBeCloseTo(authority.manut, 2);
    expect(model.finance.resultado).toBeCloseTo(authority.lucro, 2);
  });

  it("valores da massa, conferidos à mão", () => {
    const { finance } = build();
    expect(finance.receitaContratual).toBeCloseTo(7150, 2);
    expect(finance.descontos).toBeCloseTo(1050, 2);
    expect(finance.receitaLiquida).toBeCloseTo(6100, 2);
    expect(finance.receitaContratual - finance.descontos).toBeCloseTo(finance.receitaLiquida, 2);
    expect(finance.repasses).toBeCloseTo(1660, 2);
    expect(finance.manutencao).toBeCloseTo(300, 2);
    expect(finance.custo).toBeCloseTo(1960, 2);
    expect(finance.resultado).toBeCloseTo(4140, 2);
    expect(finance.margem).toBeCloseTo(4140 / 6100 * 100, 5);
    expect(finance.descontosQtd).toBe(1);
    expect(finance.descontosPct).toBeCloseTo(1050 / 7150 * 100, 5);
  });

  it("a soma das locações (base dos recortes) bate com o total da autoridade", () => {
    const data = buildBillingData();
    const model = build({}, BILLING_YM, data);
    const monthly = calcEquipamentosMes(data, BILLING_YM);
    expect(model.rows.reduce((t, row) => t + row.receita, 0)).toBeCloseTo(monthly.total.receita, 2);
    expect(model.rows.reduce((t, row) => t + row.custoDono, 0)).toBeCloseTo(monthly.total.custoDono, 2);
    expect(model.operation.unidadeDias).toBe(calcEquipamentosPorObra(data, BILLING_YM).total.unidadeDias);
  });
});

describe("recortes: manutenção só entra quando pode ser apropriada", () => {
  it("por obra: custo = repasses, manutenção não apropriada (e o modelo diz isso)", () => {
    const { finance } = build({ obraId: "ob-a" });
    expect(finance.receitaLiquida).toBeCloseTo(1950, 2);
    expect(finance.repasses).toBeCloseTo(160, 2);
    expect(finance.manutencao).toBeNull();
    expect(finance.manutencaoApropriada).toBe(false);
    expect(finance.custo).toBeCloseTo(160, 2);
    expect(finance.resultado).toBeCloseTo(1790, 2);
  });

  it("por propriedade: manutenção dos equipamentos daquela propriedade", () => {
    const proprios = build({ propriedade: "proprios" }).finance;
    expect(proprios.receitaLiquida).toBeCloseTo(4650, 2);
    expect(proprios.manutencao).toBeCloseTo(300, 2);
    expect(proprios.resultado).toBeCloseTo(4350, 2);
    const terceiros = build({ propriedade: "terceiros" }).finance;
    expect(terceiros.receitaLiquida).toBeCloseTo(1450, 2);
    expect(terceiros.manutencao).toBeCloseTo(0, 2);
    expect(terceiros.resultado).toBeCloseTo(-210, 2);
    expect(terceiros.margem).toBeLessThan(0);
  });
});

describe("próprios x terceiros", () => {
  it("divide receita, custo, resultado, margem e participação; terceiros negativos ficam negativos", () => {
    const { split, finance } = build();
    expect(split.proprios.receitaLiquida).toBeCloseTo(4650, 2);
    expect(split.terceiros.receitaLiquida).toBeCloseTo(1450, 2);
    expect(split.proprios.resultado + split.terceiros.resultado).toBeCloseTo(finance.resultado, 2);
    expect(split.terceiros.resultado).toBeCloseTo(-210, 2);
    expect(split.proprios.participacao + split.terceiros.participacao).toBeCloseTo(100, 5);
  });
});

describe("filtros", () => {
  it("obra, propriedade, situação da cobrança, pendência e busca", () => {
    expect(ids(build({ obraId: "ob-b" }))).toEqual(["G1", "S1"]);
    expect(ids(build({ propriedade: "terceiros" }))).toEqual(["A1", "C1", "T1"]);
    expect(ids(build({ situacao: "pendente" }))).toEqual(["G1"]);
    expect(ids(build({ situacao: "a_faturar" }))).toEqual(["C1"]);
    expect(ids(build({ pendencia: "qualquer" }))).toEqual(["G1", "S1", "T1"]);
    expect(ids(build({ pendencia: PENDING_TYPE.NEGATIVE }))).toEqual(["C1"]);
    expect(ids(build({ pendencia: PENDING_TYPE.NO_RATE }))).toEqual(["S1"]);
    expect(ids(build({ busca: "locadora norte" }))).toEqual(["A1", "C1", "T1"]);
    expect(ids(build({ busca: "fat-202609-002" }))).toEqual(["G1"]);
    expect(ids(build({ busca: "oasis" }))).toEqual(["G1", "S1"]); // sem acento
  });

  it("filtros combinados e contagem para 'Limpar filtros'", () => {
    const filters = { obraId: "ob-a", propriedade: "terceiros", pendencia: "qualquer" };
    expect(ids(build(filters))).toEqual(["T1"]);
    expect(activeBillingFilterCount({ ...DEFAULT_BILLING_FILTERS, ...filters })).toBe(3);
    expect(activeBillingFilterCount(DEFAULT_BILLING_FILTERS)).toBe(0);
  });

  it("indicadores, ranking e operação seguem o filtro", () => {
    const model = build({ obraId: "ob-b" });
    expect(model.operation.locacoes).toBe(2);
    expect(model.operation.obras).toBe(1);
    expect(model.works.map(work => work.id)).toEqual(["ob-b"]);
    expect(model.attention.map(item => item.type).sort()).toEqual([PENDING_TYPE.HIGH_DISCOUNT, PENDING_TYPE.NO_RATE, PENDING_TYPE.OVERDUE].sort());
  });

  it("chips e escopo descrevem o recorte", () => {
    const model = build({ obraId: "ob-a", propriedade: "terceiros", pendencia: PENDING_TYPE.NO_COST_RATE });
    const options = buildBillingFilterOptions(model);
    expect(buildBillingChips(model.filters, options).map(chip => chip.label)).toEqual(["K1-04 — Terras Alpha", "Terceiros", "Repasse sem tarifa de custo"]);
    expect(billingScopeLabel(model, options)).toBe("Setembro 2026 · K1-04 — Terras Alpha · terceiros · filtros ativos");
    expect(billingScopeLabel(build(), buildBillingFilterOptions(build()))).toBe("Setembro 2026 · todas as obras");
  });

  it("obra filtrada sem locação na competência continua nomeada no filtro", () => {
    const data = buildBillingData();
    const model = buildBillingDashboard(data, { ym: "2026-03", hoje: BILLING_HOJE, filters: { obraId: "ob-a" } });
    const options = buildBillingFilterOptions(model, data);
    expect(options.obras.find(item => item.value === "ob-a")?.label).toBe("K1-04 — Terras Alpha");
    expect(buildBillingChips(model.filters, options)[0].label).toBe("K1-04 — Terras Alpha");
  });
});

describe("operação (separada do financeiro)", () => {
  it("equipamentos, locações, obras e utilização pela mesma fórmula da tela anterior", () => {
    const { operation } = build();
    expect(operation).toMatchObject({ equipamentos: 6, locacoes: 6, obras: 3, unidadeDias: 88, unidadesFrota: 18, capacidade: 540 });
    expect(operation.utilizacao).toBeCloseTo(88 / 540 * 100, 5);
  });
});

describe("faturamento: ciclo de cobrança, separado da receita (não alimenta o DRE)", () => {
  it("faturado, recebido, em aberto, vencido e medido sem fatura", () => {
    const { billing, finance } = build();
    expect(billing).toMatchObject({ faturado: 4500, recebido: 1500, emAberto: 3000, vencido: 3000, faturas: 2, faturasVencidas: 1, medidoSemFatura: 1000, temDados: true });
    // faturado nunca é somado à receita
    expect(finance.receitaLiquida).toBeCloseTo(6100, 2);
  });

  it("sem faturas na competência, o modelo diz que não há dados (não inventa zero como fato)", () => {
    const data = buildBillingData();
    data.rentalInvoices = []; data.rentalChargeItems = [];
    expect(build({}, BILLING_YM, data).billing.temDados).toBe(false);
  });
});

describe("atenção necessária e fechamento", () => {
  it("só exceções que regras existentes produzem, cada uma com tipo para o drill-down", () => {
    const { attention } = build();
    expect(attention.map(item => item.type)).toEqual([
      PENDING_TYPE.NO_RATE, PENDING_TYPE.NO_COST_RATE, PENDING_TYPE.NEGATIVE, PENDING_TYPE.OVERDUE, PENDING_TYPE.HIGH_DISCOUNT,
    ]);
    expect(attention.find(item => item.type === PENDING_TYPE.OVERDUE).amount).toBe(3000);
    expect(attention.find(item => item.type === PENDING_TYPE.NEGATIVE).label).toBe("1 obra com resultado negativo");
  });

  it("fechamento explica o estado pelos fatos e não finge conferência registrada", () => {
    const { closing } = build();
    expect(closing.status).toBe("revisar");
    expect(closing.label).toBe("Revisar antes da conferência");
    expect(closing.checks.map(check => check.label)).toEqual([
      "5/6 locações com tarifa e cobrança calculada",
      "2/3 repasses de terceiros com tarifa de custo",
      "1 desconto(s) elevado(s) para revisar",
      "1 fatura(s) vencida(s) no ciclo de cobrança",
    ]);
  });

  it("sem pendência: pronto para conferência e nenhuma exceção", () => {
    const model = build({ obraId: "ob-a", pendencia: "none", busca: "betoneira" });
    expect(model.attention).toEqual([]);
    expect(model.closing.status).toBe("pronto");
  });

  it("competência sem locações: sem dados (não 'pronto')", () => {
    const model = build({}, "2026-03");
    expect(model.hasMonthData).toBe(false);
    expect(model.closing.status).toBe("sem_dados");
    expect(model.finance.receitaLiquida).toBe(0);
    expect(model.operation.utilizacao).toBe(0);
  });
});

describe("comparação temporal e tendência", () => {
  it("compara com a competência anterior do mesmo recorte", () => {
    const { previous } = build();
    expect(previous.label).toBe("Agosto 2026");
    expect(previous.receitaLiquida.valor).toBeCloseTo(1600, 2);
    expect(previous.receitaLiquida.variacaoPct).toBeCloseTo((6100 - 1600) / 1600 * 100, 5);
    expect(previous.resultado.diferenca).toBeCloseTo(4140 - 1600, 2);
    expect(previous.utilizacao.diferencaPp).toBeCloseTo(88 / 540 * 100 - 31 / 558 * 100, 5);
  });

  it("sem dados no mês anterior, não há comparação (ausência não vira zero)", () => {
    expect(build({}, "2026-08").previous).toBeNull(); // julho sem locações
    expect(build({ obraId: "ob-c" }).previous).toBeNull(); // a obra não existia em agosto
  });

  it("tendência de 6 meses marca os meses sem dados", () => {
    const { trend } = build();
    expect(trend.map(point => point.ym)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(trend.filter(point => !point.semDados).map(point => point.ym)).toEqual(["2026-08", "2026-09"]);
    expect(trend.at(-1).receitaLiquida).toBeCloseTo(6100, 2);
  });
});

describe("ranking e memória por obra", () => {
  it("ranking com receita, custo (repasse), resultado, margem e pendências; ordenável", () => {
    const { works } = build();
    expect(sortWorks(works).map(work => work.id)).toEqual(["ob-b", "ob-a", "ob-c"]);
    expect(sortWorks(works, { key: "resultado", dir: "asc" })[0].id).toBe("ob-c");
    const c = works.find(work => work.id === "ob-c");
    expect(c).toMatchObject({ codigo: "G2-01", locacoes: 1, equipamentos: 1, negativa: true });
    expect(c.resultado).toBeCloseTo(-500, 2);
    expect(works.find(work => work.id === "ob-b").pendencias).toBe(3); // sem tarifa + desconto elevado + fatura vencida
  });

  it("barras de resultado: maior para menor, negativo identificado", () => {
    const bars = workResultBars(build());
    expect(bars.map(bar => bar.id)).toEqual(["ob-b", "ob-a", "ob-c"]);
    expect(bars.at(-1)).toMatchObject({ negative: true });
    expect(bars[0].ratio).toBe(1);
  });

  it("memória da obra: financeiro, cobrança, equipamentos e pendências reais", () => {
    const memory = buildWorkMemory(build(), "ob-b");
    expect(memory.finance.receitaContratual).toBeCloseTo(4200, 2);
    expect(memory.finance.descontos).toBeCloseTo(1050, 2);
    expect(memory.billing).toMatchObject({ faturado: 3000, emAberto: 3000, faturas: 1 });
    expect(memory.rows.map(row => row.locacaoId)).toEqual(["G1", "S1"]);
    expect(memory.pendencias.map(item => item.type).sort()).toEqual([PENDING_TYPE.HIGH_DISCOUNT, PENDING_TYPE.NO_RATE, PENDING_TYPE.OVERDUE].sort());
    expect(buildWorkMemory(build(), "inexistente")).toBeNull();
  });
});
