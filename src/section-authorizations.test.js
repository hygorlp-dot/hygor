import { describe, expect, test } from "vitest";
import { authorizeSectionChanges, validateNoPhysicalDeletes } from "../server/section-authorizations.js";

describe("SEC-002 · autorização por seção e obra",()=>{
  test("recusa usuário comum tentando gravar financeiro manualmente",()=>{
    expect(authorizeSectionChanges({role:"engenheiro",obraId:"o1"},{payments:[{obraId:"o1"}]})).toMatch(/permissão/i);
  });
  test("recusa compras de outra obra mesmo para papel autorizado",()=>{
    expect(authorizeSectionChanges({role:"compras",obraId:"o1"},{pedidos:[{obraId:"o2"}]})).toMatch(/outra obra/i);
  });
  test("permite financeiro no próprio escopo e bloqueia seções desconhecidas",()=>{
    expect(authorizeSectionChanges({role:"financeiro",obraId:"o1"},{payments:[{obraId:"o1"}]})).toBe("");
    expect(authorizeSectionChanges({role:"financeiro"},{segredo:[{}]})).toMatch(/não pode/i);
  });
  test("bloqueia remoção física de fato financeiro e preserva cancelamento lógico",()=>{
    expect(validateNoPhysicalDeletes({pedidos:[{id:"p1"}]},{pedidos:[]})).toMatch(/Não é permitido/i);
    expect(validateNoPhysicalDeletes({pedidos:[{id:"p1"}]},{pedidos:[{id:"p1",status:"cancelado",motivoCancelamento:"duplicado"}]})).toBe("");
  });
  test("preserva conferência e pendência: ambos exigem cancelamento motivado",()=>{
    const anterior={conferencias:[{id:"c1",pendencias:[{id:"p1",status:"aberta"}]}]};
    expect(validateNoPhysicalDeletes(anterior,{conferencias:[{id:"c1",pendencias:[]}]})).toMatch(/pendências/i);
    expect(validateNoPhysicalDeletes(anterior,{conferencias:[{id:"c1",pendencias:[{id:"p1",status:"cancelada"}]}]})).toMatch(/motivo/i);
    expect(validateNoPhysicalDeletes(anterior,{conferencias:[{id:"c1",pendencias:[{id:"p1",status:"cancelada",motivoCancelamento:"duplicada"}]}]})).toBe("");
  });
  test("protege liquidações e recebimentos aninhados contra exclusão física",()=>{
    const anterior={pedidos:[{id:"p1",pagamentos:[{id:"pg1",valor:100}]}]};
    expect(validateNoPhysicalDeletes(anterior,{pedidos:[{id:"p1",pagamentos:[]}]})).toMatch(/pagamentos de pedidos/i);
    expect(validateNoPhysicalDeletes(anterior,{pedidos:[{id:"p1",pagamentos:[{id:"pg1",valor:100,status:"estornado",motivoEstorno:"duplicado"}]}]})).toBe("");
  });
  test("permite criar fechamento e impede alterar ou excluir snapshot fechado",()=>{
    const fechamento={id:"fechamento-2026-07",competencia:"2026-07",status:"fechado",snapshot:{resultCents:10000}};
    expect(validateNoPhysicalDeletes(
      {fechamentosFinanceiros:[]},
      {fechamentosFinanceiros:[fechamento]},
    )).toBe("");
    expect(validateNoPhysicalDeletes(
      {fechamentosFinanceiros:[fechamento]},
      {fechamentosFinanceiros:[{...fechamento,snapshot:{resultCents:9000}}]},
    )).toMatch(/imutáveis/i);
    expect(validateNoPhysicalDeletes(
      {fechamentosFinanceiros:[fechamento]},
      {fechamentosFinanceiros:[]},
    )).toMatch(/excluir|excluídos/i);
  });
});
