import {describe,expect,it} from "vitest";
import {buildPurchaseOrderLiveRow,buildQuotationLiveRow} from "./purchase-quote-order-live-write.js";
import {purchaseOrderRow,quotationRow} from "./procurement-registry-shadow.js";

// Confere só a conversão de forma (camelCase de quotationRow/purchaseOrderRow
// -> snake_case para .upsert() direto) e o reuso do MESMO hash calculado
// pelo módulo de sombra - o cálculo de hash em si já é coberto por
// procurement-registry-shadow.test.js.

describe("buildQuotationLiveRow",()=>{
  it("converte para snake_case e reaproveita o hash de quotationRow",()=>{
    const quote={
      id:"cot-1",obraId:"obra-1",materialId:"mat-1",qtd:10,status:"aberta",
      version:2,solicitacaoId:"sol-1",propostas:[{id:"p1",fornecedorId:"f1",precoUnit:25}],
    };
    const row=buildQuotationLiveRow("arcd",quote);
    expect(row).toMatchObject({
      company_id:"arcd",id:"cot-1",project_id:"obra-1",material_id:"mat-1",
      request_id:"sol-1",status:"aberta",active:true,quantity:10,source_version:2,
    });
    expect(row.source_hash).toBe(quotationRow(quote).sourceHash);
    expect(row.payload).toBe(quote);
    expect(typeof row.synced_at).toBe("string");
  });

  it("usa null (não string vazia) para request_id quando a cotação não tem solicitação de origem",()=>{
    const row=buildQuotationLiveRow("arcd",{id:"cot-2",obraId:"obra-1",materialId:"mat-1",qtd:1});
    expect(row.request_id).toBeNull();
  });

  it("active é false quando a cotação está cancelada",()=>{
    const row=buildQuotationLiveRow("arcd",{id:"cot-3",obraId:"obra-1",materialId:"mat-1",qtd:1,status:"cancelada"});
    expect(row.active).toBe(false);
  });
});

describe("buildPurchaseOrderLiveRow",()=>{
  it("converte para snake_case e reaproveita o hash de purchaseOrderRow",()=>{
    const order={
      id:"ped-1",obraId:"obra-1",fornecedorId:"forn-1",cotacaoId:"cot-1",
      solicitacaoId:"sol-1",numero:"PED-001",status:"enviado",version:3,
      itens:[{id:"item-1",materialId:"mat-1",qtd:10,precoUnit:25}],
    };
    const row=buildPurchaseOrderLiveRow("arcd",order);
    expect(row).toMatchObject({
      company_id:"arcd",id:"ped-1",project_id:"obra-1",supplier_id:"forn-1",
      quote_id:"cot-1",request_id:"sol-1",numero:"PED-001",status:"enviado",
      active:true,source_version:3,
    });
    expect(row.source_hash).toBe(purchaseOrderRow(order).sourceHash);
    expect(row.payload).toBe(order);
  });

  it("usa null (não string vazia) para quote_id/request_id quando o pedido não veio de cotação/solicitação",()=>{
    const row=buildPurchaseOrderLiveRow("arcd",{id:"ped-2",obraId:"obra-1",fornecedorId:"forn-1",numero:"PED-002"});
    expect(row.quote_id).toBeNull();
    expect(row.request_id).toBeNull();
  });

  it("active é false quando o pedido está cancelado",()=>{
    const row=buildPurchaseOrderLiveRow("arcd",{id:"ped-3",obraId:"obra-1",fornecedorId:"forn-1",numero:"PED-003",status:"cancelado"});
    expect(row.active).toBe(false);
  });
});
