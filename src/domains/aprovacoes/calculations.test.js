import { avaliarCondicao, avaliarCondicoes, calcularVencimento, prazoVencido } from "./calculations";

describe("operadores de condição", () => {
  const ctx = { valorTotal: 5000, obraId: "o1", categoria: "material", urgencia: "alta" };

  test("igual / diferente", () => {
    expect(avaliarCondicao({ campo: "obraId", operador: "igual", valor: "o1" }, ctx)).toBe(true);
    expect(avaliarCondicao({ campo: "obraId", operador: "diferente", valor: "o1" }, ctx)).toBe(false);
  });

  test("maior / maior_igual / menor / menor_igual", () => {
    expect(avaliarCondicao({ campo: "valorTotal", operador: "maior", valor: 1000 }, ctx)).toBe(true);
    expect(avaliarCondicao({ campo: "valorTotal", operador: "maior_igual", valor: 5000 }, ctx)).toBe(true);
    expect(avaliarCondicao({ campo: "valorTotal", operador: "menor", valor: 1000 }, ctx)).toBe(false);
    expect(avaliarCondicao({ campo: "valorTotal", operador: "menor_igual", valor: 5000 }, ctx)).toBe(true);
  });

  test("entre", () => {
    expect(avaliarCondicao({ campo: "valorTotal", operador: "entre", valor: [1000, 10000] }, ctx)).toBe(true);
    expect(avaliarCondicao({ campo: "valorTotal", operador: "entre", valor: [10000, 20000] }, ctx)).toBe(false);
  });

  test("contem", () => {
    expect(avaliarCondicao({ campo: "categoria", operador: "contem", valor: "mater" }, ctx)).toBe(true);
  });

  test("pertence_lista / nao_pertence_lista", () => {
    expect(avaliarCondicao({ campo: "categoria", operador: "pertence_lista", valor: ["material", "servico"] }, ctx)).toBe(true);
    expect(avaliarCondicao({ campo: "categoria", operador: "nao_pertence_lista", valor: ["equipamento"] }, ctx)).toBe(true);
  });

  test("condições no mesmo grupoLogico combinam com OU; grupos diferentes combinam com E", () => {
    const condicoes = [
      { campo: "categoria", operador: "igual", valor: "material", grupoLogico: "g1" },
      { campo: "categoria", operador: "igual", valor: "servico", grupoLogico: "g1" },
      { campo: "urgencia", operador: "igual", valor: "alta" },
    ];
    expect(avaliarCondicoes(condicoes, ctx)).toBe(true);
    expect(avaliarCondicoes(condicoes, { ...ctx, urgencia: "baixa" })).toBe(false);
  });

  test("sem condições, sempre aplica", () => {
    expect(avaliarCondicoes([], ctx)).toBe(true);
    expect(avaliarCondicoes(null, ctx)).toBe(true);
  });
});

describe("prazos", () => {
  test("calcularVencimento em horas", () => {
    const v = calcularVencimento("2026-01-10T10:00:00.000Z", 5, "horas");
    expect(new Date(v).toISOString()).toBe("2026-01-10T15:00:00.000Z");
  });

  test("calcularVencimento em dias úteis pula sábado e domingo", () => {
    // 2026-01-09 é sexta-feira
    const v = calcularVencimento("2026-01-09T12:00:00.000Z", 2, "dias_uteis");
    expect(v.slice(0, 10)).toBe("2026-01-13"); // pula sáb/dom, cai na terça
  });

  test("prazoVencido compara corretamente", () => {
    expect(prazoVencido("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z")).toBe(true);
    expect(prazoVencido("2026-01-05T00:00:00.000Z", "2026-01-02T00:00:00.000Z")).toBe(false);
    expect(prazoVencido(null, "2026-01-02T00:00:00.000Z")).toBe(false);
  });
});
