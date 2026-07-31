import { describe, expect, it } from "vitest";
import { validateProcurementChain } from "./procurement-chain-policy.js";

const valid={
  solicitacoesCompra:[{id:"s1",obraId:"o1",pedidoId:"p1",cotacaoIds:["c1"]}],
  cotacoes:[{id:"c1",obraId:"o1",solicitacaoId:"s1",pedidoId:"p1"}],
  pedidos:[{id:"p1",obraId:"o1",solicitacaoId:"s1",cotacaoId:"c1"}],
  notasFiscais:[{id:"n1",obraId:"o1",pedidoId:"p1"}],
};

describe("COMP-001 — cadeia canônica de compras",()=>{
  it("aceita vínculos bidirecionais na mesma obra",()=>expect(validateProcurementChain(valid)).toBe(""));
  it("recusa referência inexistente ou entre obras",()=>{
    expect(validateProcurementChain({...valid,pedidos:[{...valid.pedidos[0],cotacaoId:"nao-existe"}]})).toMatch(/vínculo|inexistente/);
    expect(validateProcurementChain({...valid,notasFiscais:[{...valid.notasFiscais[0],obraId:"o2"}]})).toMatch(/mesma obra/);
  });
  it("recusa ligação unilateral entre cotação e pedido",()=>{
    expect(validateProcurementChain({...valid,cotacoes:[{...valid.cotacoes[0],pedidoId:""}]})).toMatch(/apontar um para o outro/);
  });
});
