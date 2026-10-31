import { describe, expect, it } from "vitest";
import { resumoGestaoAVista, situacaoDaObra } from "./gestao-a-vista.js";

describe("regra de situação (aprovada em 30/10/2026)", () => {
  const base = { desvio: null, diasEntrega: null, pendenciasPonto: 0 };
  it("crítico acima de 5 pontos ou prazo vencido", () => {
    expect(situacaoDaObra({ ...base, desvio: 5.1 }).situacao).toBe("critico");
    expect(situacaoDaObra({ ...base, diasEntrega: -1 })).toMatchObject({ situacao: "critico", motivo: "Prazo vencido há 1 dia(s)" });
  });
  it("atenção de 2 a 5 pontos, entrega em menos de 30 dias ou ponto pendente", () => {
    expect(situacaoDaObra({ ...base, desvio: 5 }).situacao).toBe("atencao");
    expect(situacaoDaObra({ ...base, desvio: 2 }).situacao).toBe("atencao");
    expect(situacaoDaObra({ ...base, diasEntrega: 29 }).situacao).toBe("atencao");
    expect(situacaoDaObra({ ...base, pendenciasPonto: 2 }).motivo).toBe("2 pessoa(s) sem ponto no último dia útil");
  });
  it("em dia abaixo de 2 pontos, sem prazo próximo nem pendência; dado ausente não vira alerta", () => {
    expect(situacaoDaObra({ ...base, desvio: 1.9, diasEntrega: 30 }).situacao).toBe("ok");
    expect(situacaoDaObra(base).situacao).toBe("ok");
  });
});

const lotacao = (emp, data, registro) => registro?.obraId || emp.obra;
const dadosObra = overrides => ({
  obras: [
    { id: "o1", name: "P1-08", status: "active", startDate: "2026-06-01", contractEnd: "2026-11-15" },
    { id: "o2", name: "CA1-06", status: "active", startDate: "2026-06-01" },
    { id: "o3", name: "Antiga", status: "done" },
  ],
  budgetBaselines: [{ id: "b1", obraId: "o1", ativo: true, tipo: "controle", budgetId: "orc1" }],
  orcamentos: [{ id: "orc1", obraId: "o1", etapas: [{ id: "e1", nome: "Fundação" }, { id: "e2", nome: "Estrutura" }],
    itens: [{ etapaId: "e1", quantidade: 1, precoUnit: 40000 }, { etapaId: "e2", quantidade: 1, precoUnit: 60000 }] }],
  planos: [{ obraId: "o1", tarefas: [
    { id: "t1", etapaId: "e1", inicio: "2026-06-01", fim: "2026-06-30", progresso: 100 },
    { id: "t2", etapaId: "e2", inicio: "2026-07-01", fim: "2026-09-29", progresso: 40 },
  ] }],
  medicoes: [{ obraId: "o1", tipo: "percentual", percentualAcumulado: 50 }],
  employees: [
    { id: "a", obra: "o1", active: true, startDate: "2026-01-01" },
    { id: "b", obra: "o1", active: true, startDate: "2026-01-01" },
    { id: "c", obra: "o2", active: true, startDate: "2026-01-01", remunerationMode: "mei" },
  ],
  attendance: { a: { "2026-10-29": { status: "P", obraId: "o1" }, "2026-10-30": { status: "P", obraId: "o1" } } },
  ...overrides,
});

describe("resumo das obras ativas", () => {
  const custoAcumulado = (data, obraId, ano, mes) => {
    expect([ano, mes]).toEqual([2026, 8]); // setembro: último mês fechado em 30/10
    return obraId === "o1" ? { custo: 58000 } : null;
  };

  it("compara custo do orçamento aprovado com o avanço medido e classifica", () => {
    const { linhas, contagem, equipeHoje } = resumoGestaoAVista(dadosObra(), { hoje: "2026-10-30", custoAcumulado, obraDoDia: lotacao });
    expect(linhas.map(l => l.id)).toEqual(["o1", "o2"]);
    const o1 = linhas[0];
    expect(o1).toMatchObject({ orcado: 100000, custo: 58000, gastoPct: 58, avanco: 50, avancoFonte: "medicao", desvio: 8,
      situacao: "critico", motivo: "Custo 8 pontos à frente do avanço", etapaAtual: "Estrutura", diasEntrega: 16, equipeHoje: 1, pendenciasPonto: 1 });
    expect(o1.etapas.map(e => e.estado)).toEqual(["feita", "atual"]);
    expect(linhas[1]).toMatchObject({ orcado: null, custo: null, desvio: null, avanco: null, situacao: "ok", pendenciasPonto: 0 });
    expect(contagem).toEqual({ critico: 1, atencao: 0, ok: 1 });
    expect(equipeHoje).toBe(1);
  });

  it("em janeiro o último mês fechado é dezembro do ano anterior", () => {
    const meses = [];
    const { custoAte } = resumoGestaoAVista(dadosObra(), { hoje: "2027-01-05", custoAcumulado: (d, id, ano, mes) => { meses.push([ano, mes]); return null; }, obraDoDia: lotacao });
    expect(custoAte).toBe("2026-12");
    expect(meses[0]).toEqual([2026, 11]);
  });

  it("rascunho de orçamento não entra no custo × orçado; sem medição usa o cronograma identificado", () => {
    const { linhas } = resumoGestaoAVista(dadosObra({ budgetBaselines: [], medicoes: [] }), { hoje: "2026-10-30", custoAcumulado, obraDoDia: lotacao });
    expect(linhas[0]).toMatchObject({ orcado: null, gastoPct: null, desvio: null, avancoFonte: "cronograma" });
    expect(linhas[0].avanco).toBeGreaterThan(0);
  });
});
