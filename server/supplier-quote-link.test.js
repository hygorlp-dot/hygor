import {it,expect} from "vitest";
import {quoteLinkKey,issueQuoteLink,verifyQuoteLink,quoteLinkAccess,publicQuoteView} from "./supplier-quote-link.js";
import {storeSupplierResponse,quoteResponseScope} from "../src/domains/compras/supplier-quote-response.js";
import {applyOperationalCommand,OPERATIONAL_COMMAND} from "../src/domains/sync/operational-commands.js";
import {mapaDaCotacao} from "../src/domains/compras/quote-map.js";
const key=quoteLinkKey({PEDIDO_ACEITE_SECRET:"s".repeat(40)}),now=1793358000000;
const fixture=()=>({obras:[{id:"o"}],materiais:[{id:"m",descricao:"Cimento"}],fornecedores:[{id:"f",nome:"Loja"},{id:"secret",nome:"Concorrente secreto"}],cotacoes:[{id:"q",numero:"C1",obraId:"o",materialId:"m",qtd:2,status:"aberta",version:1,propostas:[{id:"p",fornecedorId:"f",precoUnit:10},{id:"p2",fornecedorId:"secret",precoUnit:9999}]}]});
const body={nome:"Vendedor",precos:{__item:12},prazoDias:3,custoFinal:{frete:5,desconto:0,impostos:0,despesas:0},condicoesPagamento:"30 dias",documentos:[{nome:"Proposta",url:"https://example.test/proposta.pdf"}]};
const respond=data=>storeSupplierResponse(data,{quoteId:"q",proposalId:"p",responseId:"r",scope:quoteResponseScope(data.cotacoes[0]),body});
const review=(data,decision="aceita",extra={})=>applyOperationalCommand(data,{type:OPERATIONAL_COMMAND.QUOTE_SUPPLIER_RESPONSE_REVIEWED,idempotencyKey:"supplier-review-test-0001",actorId:"compras",actorRole:"compras",actorName:"Compras",expectedVersion:data.cotacoes[0].version,payload:{quoteId:"q",responseId:"r",decision,reason:"Valores conferidos"},...extra});
it("link assinado vence e é isolado por empresa, fornecedor e finalidade",()=>{
 const data=fixture(),issued=issueQuoteLink({key,quote:data.cotacoes[0],proposalId:"p",company:"a",now});
 const claims=verifyQuoteLink({key,token:issued.token,company:"a",now});expect(claims.p).toBe("p");expect(quoteLinkAccess(data,claims)).not.toBeNull();
 expect(verifyQuoteLink({key,token:issued.token+"x",company:"a",now})).toBeNull();expect(verifyQuoteLink({key,token:issued.token,company:"b",now})).toBeNull();expect(verifyQuoteLink({key,token:issued.token,company:"a",now:now+8*86400000})).toBeNull();
 data.cotacoes[0].propostas[0].fornecedorId="secret";expect(quoteLinkAccess(data,claims)).toBeNull();data.cotacoes[0].propostas[0].fornecedorId="f";
 data.cotacoes[0].qtd=3;expect(quoteLinkAccess(data,claims)).toBeNull();
});
it("visão pública não revela concorrentes, preços, orçamento ou registros internos",()=>{
 const data=fixture(),issued=issueQuoteLink({key,quote:data.cotacoes[0],proposalId:"p",company:"a",now});const view=publicQuoteView(data,quoteLinkAccess(data,verifyQuoteLink({key,token:issued.token,company:"a",now})));
 expect(view.itens[0]).toMatchObject({descricao:"Cimento",qtd:2});expect(JSON.stringify(view)).not.toMatch(/9999|Concorrente|precoUnit|propostas/);
});
it("resposta fica pendente, bloqueia oferta no mapa e não gera pedido até revisão",()=>{
 const data=fixture(),before=JSON.stringify(data),result=respond(data);expect(result.ok).toBe(true);expect(JSON.stringify(data)).toBe(before);expect(result.data.pedidos).toBeUndefined();expect(result.data.cotacoes[0].propostas[0].precoUnit).toBe(10);expect(mapaDaCotacao(result.data.cotacoes[0]).linhas[0].ofertas.map(o=>o.proposta.id)).toEqual(["p2"]);
 const accepted=review(result.data);expect(accepted.ok).toBe(true);expect(accepted.data.cotacoes[0].propostas[0]).toMatchObject({precoUnit:12,custoFinal:{frete:5},respostaFornecedorId:"r"});expect(accepted.data.pedidos).toBeUndefined();expect(accepted.data.cotacoes[0].status).toBe("aberta");expect(accepted.data.cotacoes[0].respostasFornecedor[0].status).toBe("aceita");
});
it("reenvio idempotente não cria duplicata e revisões exigem versão, perfil e motivo",()=>{
 const result=respond(fixture());const q=result.data.cotacoes[0];expect(storeSupplierResponse(result.data,{quoteId:"q",proposalId:"p",responseId:"r",scope:quoteResponseScope(q),body}).idempotent).toBe(true);
 expect(review(result.data,"aceita",{actorRole:"fornecedor"}).ok).toBe(false);expect(review(result.data,"aceita",{expectedVersion:1}).ok).toBe(false);
 const rejected=review(result.data,"rejeitada");expect(rejected.ok).toBe(true);expect(rejected.data.cotacoes[0].propostas[0].precoUnit).toBe(10);
});
it("itens alterados invalidam aceite da resposta pendente",()=>{const data=respond(fixture()).data;data.cotacoes[0].qtd=99;expect(review(data).ok).toBe(false);});
it.each([
 {precos:{__item:-1}},{precos:{}},{prazoDias:-1},{custoFinal:{frete:0}},{documentos:[{url:"javascript:alert(1)"}]},{documentos:[{url:"https://usuario:senha@example.test/a"}]},{nome:"a"}
])("rejeita resposta inválida %j",patch=>{const data=fixture();expect(storeSupplierResponse(data,{quoteId:"q",proposalId:"p",responseId:"r",scope:quoteResponseScope(data.cotacoes[0]),body:{...body,...patch}}).ok).toBe(false)});
it("resposta rejeitada não pode ser alterada por reenvio do mesmo código",()=>{const data=review(respond(fixture()).data,"rejeitada").data;const again=storeSupplierResponse(data,{quoteId:"q",proposalId:"p",responseId:"r",scope:quoteResponseScope(data.cotacoes[0]),body:{...body,precos:{__item:1}}});expect(again.idempotent).toBe(true);expect(again.data.cotacoes[0].respostasFornecedor[0].offer.precoUnit).toBe(12)});
