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
    unidadeRef:"KG",unidadeCompra:"SC",fatorConversao:20,precoRef:.88,
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

  it("rejeita pedido com embalagem sem fator de conversão",()=>{
    const order=rawOrder();
    order.itens[0]={...order.itens[0],unidadeRef:"KG",unidadeCompra:"SC",fatorConversao:0};
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SAVED,{order},
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/conversão/i);
  });

  it("gera pedido a partir da proposta e encerra a cotação sem redigitação",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_CREATED_FROM_QUOTE,
      {quoteId:"c-1",proposalId:"pr-1",orderId:"p-1",itemId:"i-1",number:"PC-001",date:"2026-07-28"},
    ),"2026-07-28T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0]).toMatchObject({cotacaoId:"c-1",fornecedorId:"f-1",version:1});
    expect(result.data.pedidos[0].itens[0]).toMatchObject({
      unidadeRef:"KG",unidadeCompra:"SC",fatorConversao:20,precoRef:.88,
    });
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

// Achado ao mapear o próximo elo da cadeia de Compras (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): a criação de cotação nunca teve
// comando nem teste - era update() direto no componente. Este bloco cobre
// o comando novo (QUOTATION_SAVED) com a mesma densidade dos demais.
const rawQuote=()=>({
  id:"c-2",obraId:"o-1",materialId:"m-1",qtd:5,data:"2026-08-24",
  solicitacaoId:"s-1",
  propostas:[{id:"pr-1",fornecedorId:"f-1",precoUnit:10},{id:"pr-2",fornecedorId:"f-2",precoUnit:12}],
});

describe("comando de criação/edição de cotação (QUOTATION_SAVED)",()=>{
  it("cria a cotação, versiona, registra autoria e atualiza a solicitação de origem",()=>{
    const data=base();
    data.solicitacoesCompra=[{id:"s-1",obraId:"o-1",status:"enviada",cotacaoIds:[]}];
    data.cotacoes=[];
    const result=applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote:rawQuote()},
    ),"2026-08-24T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.cotacoes[0]).toMatchObject({
      id:"c-2",status:"aberta",version:1,criadoPorId:"u-1",escolhida:"",pedidoId:"",
    });
    expect(result.data.solicitacoesCompra[0]).toMatchObject({status:"em_analise",cotacaoIds:["c-2"]});
  });

  it("rejeita cotação com menos de 2 propostas válidas",()=>{
    const quote={...rawQuote(),propostas:[{id:"pr-1",fornecedorId:"f-1",precoUnit:10}]};
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote},
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/2 propostas/);
  });

  it("rejeita cotação com embalagem sem fator de conversão",()=>{
    const quote={...rawQuote(),unidadeRef:"KG",unidadeCompra:"SC",fatorConversao:0};
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote},
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/conversão/i);
  });

  it("rejeita cotação vinculada a solicitação de outra obra",()=>{
    const data=base();
    data.solicitacoesCompra.push({id:"s-2",obraId:"o-2",status:"enviada",cotacaoIds:[]});
    data.obras.push({id:"o-2"});
    const quote={...rawQuote(),id:"c-3",solicitacaoId:"s-2"};
    const result=applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote},
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/mesma obra/);
  });

  it("edita uma cotação aberta existente, versionando e preservando o vínculo original",()=>{
    const data=base();
    const edited={...rawQuote(),id:"c-1",qtd:9,solicitacaoId:"outra-solicitacao-ignorada"};
    const result=applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote:edited},1,
    ),"2026-08-24T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.cotacoes[0]).toMatchObject({id:"c-1",qtd:9,version:2,solicitacaoId:"s-1"});
  });

  it("rejeita edição com versão desatualizada",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote:{...rawQuote(),id:"c-1"}},0,
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/alterad[ao] por outra pessoa/);
  });

  it("rejeita edição de cotação já decidida ou cancelada",()=>{
    const data=base();
    data.cotacoes[0].status="decidida";
    const result=applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote:{...rawQuote(),id:"c-1"}},1,
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/já foi decidida ou cancelada/);
  });
});

// Achado ao completar a lacuna de comandos de Compras (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): anexar documento a uma proposta
// era a última escrita do domínio ainda feita por update() direto.
const rawDocument=()=>({
  id:"doc-1",nome:"orcamento.pdf",url:"https://example.test/orcamento.pdf",
});

describe("comando de anexação de documento à proposta (PURCHASE_QUOTE_DOCUMENT_ATTACHED)",()=>{
  it("anexa o documento à proposta correta e versiona a cotação",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED,
      {quoteId:"c-1",proposalId:"pr-1",document:rawDocument()},1,
    ),"2026-08-24T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.cotacoes[0]).toMatchObject({version:2});
    expect(result.data.cotacoes[0].propostas[0].documentos).toEqual([rawDocument()]);
    expect(result.data.cotacoes[0].propostas[1].documentos||[]).toEqual([]);
  });

  it("rejeita cotação inexistente",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED,
      {quoteId:"c-inexistente",proposalId:"pr-1",document:rawDocument()},
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/não encontrada/);
  });

  it("rejeita proposta que não pertence à cotação",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED,
      {quoteId:"c-1",proposalId:"pr-inexistente",document:rawDocument()},1,
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/não pertence a esta cotação/);
  });

  it("rejeita documento incompleto",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED,
      {quoteId:"c-1",proposalId:"pr-1",document:{id:"doc-1"}},1,
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/incompleto/);
  });

  it("rejeita documento já vinculado à mesma proposta",()=>{
    const data=base();
    data.cotacoes[0].propostas[0].documentos=[rawDocument()];
    const result=applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED,
      {quoteId:"c-1",proposalId:"pr-1",document:rawDocument()},1,
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/já está vinculado/);
  });

  it("rejeita anexação a cotação já decidida ou cancelada",()=>{
    const data=base();
    data.cotacoes[0].status="cancelada";
    const result=applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED,
      {quoteId:"c-1",proposalId:"pr-1",document:rawDocument()},1,
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/já foi decidida ou cancelada/);
  });

  it("rejeita concorrência otimista (versão desatualizada)",()=>{
    const result=applyPurchaseOrderCommand(base(),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED,
      {quoteId:"c-1",proposalId:"pr-1",document:rawDocument()},0,
    ));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/alterad[ao] por outra pessoa/);
  });
});
