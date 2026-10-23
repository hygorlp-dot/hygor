import { describe, expect, it } from "vitest";
import { validateProcurementChain } from "./procurement-chain-policy.js";
import { applyPurchaseOrderCommand,PURCHASE_ORDER_COMMAND } from "../src/domains/compras/purchase-order-commands.js";
import { applyPurchaseCancellationCommand,PURCHASE_CANCELLATION_COMMAND } from "../src/domains/compras/purchase-cancellation-command.js";

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
  it("aceita os pedidos irmãos de um mapa de cotação e o pedido cancelado como histórico (C1.3)",()=>{
    const now="2026-07-28T12:00:00.000Z";
    const command=(type,payload,expectedVersion)=>({type,payload,expectedVersion,actorId:"u1",actorName:"Compras",actorRole:"compras",idempotencyKey:`k-${type}-${Math.random()}`});
    const base={
      obras:[{id:"o1"}],fornecedores:[{id:"f1",nome:"A"},{id:"f2",nome:"B"}],
      materiais:[{id:"m1",descricao:"Cimento"},{id:"m2",descricao:"Areia"}],
      solicitacoesCompra:[{id:"s1",obraId:"o1",status:"enviada",cotacaoIds:[]}],cotacoes:[],pedidos:[],fechamentosFinanceiros:[],
    };
    const saved=applyPurchaseOrderCommand(base,command(PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote:{
      id:"c1",obraId:"o1",solicitacaoId:"s1",itens:[{id:"a",materialId:"m1",qtd:1},{id:"b",materialId:"m2",qtd:1}],
      propostas:[{id:"p-a",fornecedorId:"f1",precos:{a:10,b:20}},{id:"p-b",fornecedorId:"f2",precos:{a:20,b:10}}],
    }},0),now);
    const decided=applyPurchaseOrderCommand(saved.data,command(PURCHASE_ORDER_COMMAND.QUOTE_MAP_DECIDED,{
      quoteId:"c1",choices:{a:"p-a",b:"p-b"},orders:{f1:{orderId:"pc1"},f2:{orderId:"pc2"}},
    },1),now);
    expect(decided.data.pedidos).toHaveLength(2);
    expect(validateProcurementChain(decided.data)).toBe("");
    const cancelledOrder=applyPurchaseCancellationCommand(decided.data,{type:PURCHASE_CANCELLATION_COMMAND.PURCHASE_CANCELLED,
      idempotencyKey:"cancel-pc2-0000001",expectedVersion:1,actorId:"u1",actorName:"Compras",payload:{orderId:"pc2",reason:"Sem estoque"}},now);
    expect(cancelledOrder.ok).toBe(true);
    expect(validateProcurementChain(cancelledOrder.data)).toBe("");
  });
});
