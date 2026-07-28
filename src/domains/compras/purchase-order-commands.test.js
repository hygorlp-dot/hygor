import { describe,expect,it } from "vitest";
import {
  applyPurchaseOrderCommand,
  PURCHASE_ORDER_COMMAND,
} from "./purchase-order-commands.js";

const base=()=>({
  obras:[{id:"o-1"}],
  fornecedores:[{id:"f-1",nome:"Fornecedor",ativo:true},{id:"f-2",nome:"Fornecedor 2",ativo:true}],
  materiais:[{id:"m-1",descricao:"Cimento"}],
  solicitacoesCompra:[{id:"s-1",obraId:"o-1",status:"enviada",cotacaoIds:["c-1"]}],
  cotacoes:[{id:"c-1",obraId:"o-1",solicitacaoId:"s-1",materialId:"m-1",qtd:2,status:"aberta",version:1,
    propostas:[{id:"pr-1",fornecedorId:"f-1",precoUnit:10},{id:"pr-2",fornecedorId:"f-2",precoUnit:12}]}],
  pedidos:[],materiaisEstoque:[],pagamentos:[],fechamentosFinanceiros:[],
});
const command=(type,payload,expectedVersion=0)=>({
  type,payload,expectedVersion,actorId:"u-1",actorName:"Compras",
  idempotencyKey:`command-${type.toLowerCase()}-123456789`,
});
const rawOrder=()=>({
  id:"p-1",numero:"PC-001",obraId:"o-1",fornecedorId:"f-1",
  data:"2026-07-28",previsao:"2026-08-02",status:"enviado",
  origemPagamento:"empresa",solicitacaoId:"s-1",cotacaoId:"",
  itens:[{id:"i-1",materialId:"m-1",qtd:2,precoUnit:50}],
});

describe("comandos transacionais de pedidos",()=>{
  it("cria pedido, versiona e atualiza a solicitação relacionada",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SAVED,{order:rawOrder()},
    ),"2026-07-28T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0]).toMatchObject({id:"p-1",version:1,criadoPorId:"u-1"});
    expect(result.data.solicitacoesCompra[0]).toMatchObject({status:"pedido_gerado",pedidoId:"p-1"});
  });

  it("não permite reduzir pedido abaixo do recebido ou do valor pago",()=>{
    const data=base();
    data.pedidos=[{...rawOrder(),version:2,itens:[{id:"i-1",materialId:"m-1",qtd:2,qtdRecebida:1,precoUnit:50}],
      pagamentos:[{id:"pg-1",valor:80,status:"confirmado"}]}];
    const reduced={...rawOrder(),itens:[{id:"i-1",materialId:"m-1",qtd:.5,precoUnit:50}]};
    expect(applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SAVED,
      {order:reduced,adjustmentReason:"correção"},2,
    )).reason).toMatch(/recebido/i);
    reduced.itens[0].qtd=1;
    expect(applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SAVED,
      {order:reduced,adjustmentReason:"correção"},2,
    )).reason).toMatch(/pagamentos ativos/i);
  });

  it("gera pedido a partir da proposta e encerra a cotação sem redigitação",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_CREATED_FROM_QUOTE,
      {quoteId:"c-1",proposalId:"pr-1",orderId:"p-1",itemId:"i-1",number:"PC-001",date:"2026-07-28"},
    ),"2026-07-28T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0]).toMatchObject({cotacaoId:"c-1",fornecedorId:"f-1",version:1});
    expect(result.data.cotacoes[0]).toMatchObject({status:"decidida",pedidoId:"p-1",version:2});
  });

  it("exige justificativa quando a proposta escolhida não é a menor",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_CREATED_FROM_QUOTE,
      {quoteId:"c-1",proposalId:"pr-2",orderId:"p-1",itemId:"i-1",number:"PC-001",date:"2026-07-28"},
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/justifique/i);
  });

  it("anexa documento com controle de versão",()=>{
    const data=base();data.pedidos=[{...rawOrder(),version:3,documentos:[]}];
    const result=applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_DOCUMENT_ATTACHED,
      {orderId:"p-1",document:{id:"d-1",nome:"pedido.pdf",url:"https://example.test/pedido.pdf"}},3,
    ));
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0]).toMatchObject({version:4});
    expect(result.data.pedidos[0].documentos).toHaveLength(1);
  });

  it("cancela a cotação, preserva o pedido e remove apenas o vínculo",()=>{
    const data=base();data.pedidos=[{...rawOrder(),cotacaoId:"c-1",version:4}];
    data.cotacoes[0].pedidoId="p-1";
    const result=applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_CANCELLED,
      {quoteId:"c-1",reason:"cotação duplicada",expectedOrderVersion:4},
    ));
    expect(result.ok).toBe(true);
    expect(result.data.cotacoes[0]).toMatchObject({status:"cancelada",motivoCancelamento:"cotação duplicada"});
    expect(result.data.pedidos[0]).toMatchObject({id:"p-1",cotacaoId:"",version:5});
    expect(result.data.solicitacoesCompra[0].cotacaoIds).toEqual([]);
  });
});
