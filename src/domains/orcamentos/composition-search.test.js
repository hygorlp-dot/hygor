import { expect, it } from "vitest";
import { correspondeBuscaComposicao, composicaoComoReferencia } from "./composition-search";
it("busca todas as palavras em qualquer ordem e posição, ignorando acentos", () => {
  const item={codigo:"96555",descricao:"CONCRETAGEM DE BLOCO DE COROAMENTO OU VIGA BALDRAME, FCK 30 MPA"};
  expect(correspondeBuscaComposicao(item,"baldrame concretagem")).toBe(true);
  expect(correspondeBuscaComposicao(item,"96555 30 viga")).toBe(true);
  expect(correspondeBuscaComposicao(item,"viga laje")).toBe(false);
  expect(correspondeBuscaComposicao({descricao:"ARMAÇÃO DE PILARES COM AÇO"},"aco armacao")).toBe(true);
});
it("inclui composições salvas com preço e analítica preservados", () => {
  const itens=[{coeficiente:2,precoUnit:25}];
  expect(composicaoComoReferencia({codigo:"ARCD001",descricao:"Concreto",itens})).toMatchObject({codigo:"ARCD001",precoUnit:50,tipoItem:"COMPOSICAO",composicao:JSON.stringify(itens)});
});
