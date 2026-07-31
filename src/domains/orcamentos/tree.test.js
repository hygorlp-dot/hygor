import { describe, expect, it } from "vitest";
import { budgetStageLevel, budgetSubtreeIds, calculateBudgetTree, flattenBudgetTree } from "./tree";

describe("árvore canônica do orçamento", () => {
  const budget = { bdi:10, etapas:[{id:"a"},{id:"b",parentId:"a"}], itens:[
    { id:"1", etapaId:"a", quantidade:1, precoUnit:100 },
    { id:"2", etapaId:"b", quantidade:1, precoUnit:50, bdi:20 },
  ] };

  it("faz rollup sem duplicar custo e respeita BDI do item", () => {
    const result = calculateBudgetTree(budget);
    expect(result).toMatchObject({ custoDireto:150, total:170, qtdItens:2 });
    expect(result.arvore[0]).toMatchObject({ custoDireto:150, total:170 });
    expect(flattenBudgetTree(result.arvore).filter(row => row.tipo === "item")).toHaveLength(2);
  });

  it("resolve descendentes e nível protegendo ciclos", () => {
    expect(budgetSubtreeIds(budget.etapas, "a")).toEqual(["a", "b"]);
    expect(budgetStageLevel(budget.etapas, "b")).toBe(2);
    expect(budgetStageLevel([{id:"a",parentId:"b"},{id:"b",parentId:"a"}], "a")).toBe(2);
  });
});

