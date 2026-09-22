import { expect, it } from "vitest";
import { applyStructuralBudgetLinks, structuralBudgetRows } from "./structural-budget-apply";
const base = () => ({
  itens: [{ id:"a", descricao:"Concretagem de pilares", unidade:"M3", quantidade:0, precoUnit:100 }, { id:"b", descricao:"Concretagem de pilares", unidade:"m³", quantidade:7, precoUnit:200 }, { id:"manual", quantidade:9 }],
  memoriaCalculo: { terreo:{pilar:{concretoM3:1.06}}, pavimento1:{pilar:{concretoM3:2.4}},
    vinculosEstruturais:{"terreo-pilares.concreto":"a","pavimento1-pilares.concreto":"a"} },
});
it("soma fontes compartilhadas e reaplica sem duplicar, preservando preços e itens alheios", () => {
  const budget=base();
  const first=applyStructuralBudgetLinks(budget,"terreo-pilares");
  expect(first.ok).toBe(true);
  expect(first.budget.itens[0]).toMatchObject({quantidade:3.46,precoUnit:100});
  expect(first.budget.itens[1]).toEqual(budget.itens[1]);
  expect(first.budget.itens[2]).toEqual(budget.itens[2]);
  expect(applyStructuralBudgetLinks(first.budget,"terreo-pilares").budget.itens).toEqual(first.budget.itens);
  expect(budget.itens[0].quantidade).toBe(0);
});
it("mover ou remover vínculos recalcula o destino anterior", () => {
  let budget=applyStructuralBudgetLinks(base(),"terreo-pilares").budget;
  budget.memoriaCalculo.vinculosEstruturais["terreo-pilares.concreto"]="b";
  budget=applyStructuralBudgetLinks(budget,"terreo-pilares").budget;
  expect(budget.itens[0].quantidade).toBe(2.4);
  expect(budget.itens[1].quantidade).toBe(1.06);
  budget.memoriaCalculo.vinculosEstruturais["terreo-pilares.concreto"]="";
  expect(applyStructuralBudgetLinks(budget,"terreo-pilares").budget.itens[1].quantidade).toBe(0);
});
it("atualiza mudanças nas medidas e aceita zero medido", () => {
  const budget=base();budget.memoriaCalculo.terreo.pilar.concretoM3=0;
  expect(applyStructuralBudgetLinks(budget,"terreo-pilares").budget.itens[0].quantidade).toBe(2.4);
  expect(structuralBudgetRows(budget)["terreo-pilares"][0].value).toBe(0);
});
it("não faz aplicação parcial com destino inválido, pendência, unidade ou serviço incorreto", () => {
  for (const change of [
    b=>b.itens[0].unidade="kg",
    b=>b.itens[0].descricao="Escavação",
    b=>b.itens.shift(),
    b=>b.memoriaCalculo.terreo.pilar.precisaRevisar=true,
    b=>b.memoriaCalculo.terreo.pilar.concretoM3=-1,
    b=>b.memoriaCalculo.terreo.pilar.concretoM3="inválido",
    b=>b.versionStatus="aprovado",
  ]) {
    const budget=base();change(budget);
    const snapshot=JSON.stringify(budget);
    expect(applyStructuralBudgetLinks(budget,"terreo-pilares").ok).toBe(false);
    expect(JSON.stringify(budget)).toBe(snapshot);
  }
});
