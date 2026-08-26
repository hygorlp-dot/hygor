import { describe, expect, it } from "vitest";
import { clonarCronogramaPlano, clonarEstruturaOrcamento } from "./budget-clone";

function gerarIdSequencial(prefixo) {
  let n = 0;
  return () => `${prefixo}-${++n}`;
}

describe("clonarEstruturaOrcamento", () => {
  const orcOrigem = {
    etapas: [
      { id: "e1", nome: "Fundação", parentId: "" },
      { id: "e2", nome: "Sapatas", parentId: "e1" },
    ],
    itens: [
      { id: "i1", etapaId: "e2", tipo: "item", codigo: "12345", descricao: "Escavação", unidade: "m3", quantidade: 10, precoUnit: 50 },
      { id: "i2", etapaId: "e1", tipo: "titulo", codigo: "", descricao: "Observação", unidade: "un", quantidade: 0, precoUnit: 0 },
    ],
  };

  it("gera ids novos para etapas e itens - nunca reutiliza os da obra de origem", () => {
    const { etapas, itens } = clonarEstruturaOrcamento(orcOrigem, gerarIdSequencial("novo"));
    expect(etapas.map(e => e.id)).toEqual(["novo-1", "novo-2"]);
    expect(itens.map(i => i.id)).toEqual(["novo-3", "novo-4"]);
    expect(etapas.some(e => e.id === "e1" || e.id === "e2")).toBe(false);
  });

  it("remapeia parentId de subetapa para o novo id da etapa-mãe", () => {
    const { etapas } = clonarEstruturaOrcamento(orcOrigem, gerarIdSequencial("novo"));
    const sapatas = etapas.find(e => e.nome === "Sapatas");
    const fundacao = etapas.find(e => e.nome === "Fundação");
    expect(sapatas.parentId).toBe(fundacao.id);
  });

  it("remapeia etapaId de cada item para o novo id da etapa correspondente", () => {
    const { etapas, itens } = clonarEstruturaOrcamento(orcOrigem, gerarIdSequencial("novo"));
    const sapatas = etapas.find(e => e.nome === "Sapatas");
    const escavacao = itens.find(i => i.descricao === "Escavação");
    expect(escavacao.etapaId).toBe(sapatas.id);
  });

  it("zera codigoNaoEncontrado ao clonar - a base de preços do destino pode ser outra", () => {
    const origem = { etapas: [], itens: [{ id: "i1", etapaId: "", tipo: "item", codigo: "X", codigoNaoEncontrado: true }] };
    const { itens } = clonarEstruturaOrcamento(origem, gerarIdSequencial("novo"));
    expect(itens[0].codigoNaoEncontrado).toBe(false);
  });
});

describe("clonarCronogramaPlano", () => {
  const etapaIdMap = new Map([["e1", "novoE1"], ["e2", "novoE2"]]);

  it("descola todas as datas em bloco para que a tarefa mais antiga comece em `hoje`", () => {
    const planoOrigem = {
      inicio: "2026-01-01",
      tarefas: [
        { id: "t1", etapaId: "e1", nome: "Fundação", inicio: "2026-01-05", fim: "2026-01-10", depende: [] },
        { id: "t2", etapaId: "e2", nome: "Sapatas", inicio: "2026-01-11", fim: "2026-01-15", depende: ["t1"] },
      ],
      marcos: [{ id: "m1", nome: "Entrega da fundação", data: "2026-01-10" }],
    };
    const { tarefas, marcos, deslocamentoDias } = clonarCronogramaPlano(planoOrigem, etapaIdMap, { hoje: "2026-09-01", gerarId: gerarIdSequencial("t") });
    expect(deslocamentoDias).toBe(239); // 2026-01-05 -> 2026-09-01
    expect(tarefas[0].inicio).toBe("2026-09-01");
    expect(tarefas[0].fim).toBe("2026-09-06");
    expect(tarefas[1].inicio).toBe("2026-09-07");
    expect(tarefas[1].fim).toBe("2026-09-11");
    expect(marcos[0].data).toBe("2026-09-06");
  });

  it("remapeia etapaId de cada tarefa pelo mapa de ids do orçamento clonado", () => {
    const planoOrigem = { tarefas: [{ id: "t1", etapaId: "e1", inicio: "2026-01-01", fim: "2026-01-02", depende: [] }], marcos: [] };
    const { tarefas } = clonarCronogramaPlano(planoOrigem, etapaIdMap, { hoje: "2026-09-01", gerarId: gerarIdSequencial("t") });
    expect(tarefas[0].etapaId).toBe("novoE1");
  });

  it("remapeia depende (predecessoras) para os novos ids de tarefa, sem deixar referência solta", () => {
    const planoOrigem = {
      tarefas: [
        { id: "t1", etapaId: "e1", inicio: "2026-01-01", fim: "2026-01-02", depende: [] },
        { id: "t2", etapaId: "e2", inicio: "2026-01-03", fim: "2026-01-04", depende: ["t1"] },
      ],
      marcos: [],
    };
    const { tarefas } = clonarCronogramaPlano(planoOrigem, etapaIdMap, { hoje: "2026-09-01", gerarId: gerarIdSequencial("t") });
    const t1Novo = tarefas.find(t => t.etapaId === "novoE1");
    const t2Novo = tarefas.find(t => t.etapaId === "novoE2");
    expect(t2Novo.depende).toEqual([t1Novo.id]);
  });

  it("descarta tarefas cuja etapa não existe no orçamento clonado (etapa removida ou de outro orçamento)", () => {
    const planoOrigem = {
      tarefas: [
        { id: "t1", etapaId: "e1", inicio: "2026-01-01", fim: "2026-01-02", depende: [] },
        { id: "orfa", etapaId: "etapa-inexistente", inicio: "2026-01-01", fim: "2026-01-02", depende: [] },
      ],
      marcos: [],
    };
    const { tarefas } = clonarCronogramaPlano(planoOrigem, etapaIdMap, { hoje: "2026-09-01", gerarId: gerarIdSequencial("t") });
    expect(tarefas).toHaveLength(1);
  });

  it("preserva tarefas avulsas (sem etapaId) - não dependem do mapa de etapas", () => {
    const planoOrigem = { tarefas: [{ id: "t1", etapaId: "", nome: "Tarefa avulsa", inicio: "2026-01-01", fim: "2026-01-02", depende: [] }], marcos: [] };
    const { tarefas } = clonarCronogramaPlano(planoOrigem, etapaIdMap, { hoje: "2026-09-01", gerarId: gerarIdSequencial("t") });
    expect(tarefas).toHaveLength(1);
    expect(tarefas[0].etapaId).toBe("");
  });

  it("sem plano de origem, retorna listas vazias sem lançar erro", () => {
    const result = clonarCronogramaPlano(null, etapaIdMap, { hoje: "2026-09-01", gerarId: gerarIdSequencial("t") });
    expect(result).toEqual({ tarefas: [], marcos: [], deslocamentoDias: 0 });
  });
});
