import { describe, expect, it } from "vitest";
import { herdarVinculoDaSolicitacao } from "./budget-link.js";

const solicitacao = { id:"s1", itens:[
  { id:"si1", materialId:"cim", orcItemId:"oi-reboco", orcNivel1Id:"e3" },
  { id:"si2", materialId:"are", orcItemId:"", orcNivel1Id:"" },
  { id:"si3", materialId:"tij", orcItemId:"oi-alv", orcNivel1Id:"e2" },
  { id:"si4", materialId:"tij", orcItemId:"oi-muro", orcNivel1Id:"e5" },
] };

describe("pedido herda o vínculo de orçamento da solicitação", () => {
  it("pelo item ligado ou, sem ligação, pelo material único", () => {
    const [porId, porMaterial] = herdarVinculoDaSolicitacao([
      { id:"p1", materialId:"cim", solicitacaoItemId:"si1" },
      { id:"p2", materialId:"cim" },
    ], solicitacao);
    expect(porId).toMatchObject({ orcItemId:"oi-reboco", orcNivel1Id:"e3", vinculoHerdadoDaSolicitacao:true });
    expect(porMaterial).toMatchObject({ solicitacaoItemId:"si1", orcItemId:"oi-reboco" });
  });

  it("nunca sobrescreve vínculo escolhido no pedido e não adivinha material repetido", () => {
    const [escolhido, ambiguo, semVinculo] = herdarVinculoDaSolicitacao([
      { id:"p1", materialId:"cim", solicitacaoItemId:"si1", orcNivel1Id:"e9" },
      { id:"p2", materialId:"tij" },
      { id:"p3", materialId:"are" },
    ], solicitacao);
    expect(escolhido).toMatchObject({ orcNivel1Id:"e9" });
    expect(escolhido.vinculoHerdadoDaSolicitacao).toBeUndefined();
    expect(ambiguo.orcItemId).toBeUndefined();
    expect(semVinculo.orcItemId).toBeUndefined();
  });

  it("sem solicitação, o pedido fica como veio", () => {
    const itens = [{ id:"p1", materialId:"cim" }];
    expect(herdarVinculoDaSolicitacao(itens, null)).toBe(itens);
  });
});
