import { expect, it } from "vitest";
import { budgetOwnCompositionRows } from "./budget-own-compositions-export.js";

it("exports the open version's own items and prefers each item's saved detail", () => {
  const budget = {
    itens: [
      { id:"a", fonte:"PRÓPRIA", codigo:"CP-1", quantidade:2, precoUnit:18,
        composicao:JSON.stringify([{ codigo:"0004", coeficiente:2, precoUnit:9 }]) },
      { id:"b", fonte:"propria", codigo:"cp-1", quantidade:1, precoUnit:10 },
      { id:"c", fonte:"PRÓPRIA", codigo:"SEM-DETALHE", composicao:"Memória em texto" },
      { id:"d", fonte:"SINAPI", codigo:"CP-1" },
      { id:"e", tipo:"titulo", fonte:"PRÓPRIA", codigo:"TÍTULO" },
    ],
    composicoesProprias: [
      { codigo:"CP-1", itens:[{ codigo:"0007", coeficiente:1, precoUnit:10 }] },
      { codigo:"SOBRANDO", itens:[{ codigo:"0009" }] },
    ],
  };
  const result = budgetOwnCompositionRows(budget, new Map([["a","1.1"],["b","1.2"]]), value => String(value ?? "").toUpperCase());
  expect(result.compositions.map(row => [row[0], row[1], row[6], row[7]])).toEqual([
    ["1.1","CP-1","Memória do item",""],
    ["1.2","cp-1","Composição da versão",""],
    ["","SEM-DETALHE","Sem componentes detalhados","Memória em texto"],
  ]);
  expect(result.components.map(row => [row[0], row[4], row[7], row[8]])).toEqual([
    ["1.1","0004",2,9],
    ["1.2","0007",1,10],
  ]);
});
