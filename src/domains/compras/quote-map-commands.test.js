import { describe,expect,it } from "vitest";
import { applyPurchaseOrderCommand,PURCHASE_ORDER_COMMAND } from "./purchase-order-commands.js";
import { applyPurchaseCancellationCommand,PURCHASE_CANCELLATION_COMMAND } from "./purchase-cancellation-command.js";
import { mapaDaCotacao,sugestaoDeEscolhas } from "./quote-map.js";

const now="2026-07-28T12:00:00.000Z";
const ITENS=20;
const base=()=>({
  obras:[{id:"o-1"}],
  fornecedores:["f-1","f-2","f-3"].map(id=>({id,nome:id,ativo:true})),
  materiais:Array.from({length:ITENS},(_,i)=>({id:`m-${i}`,descricao:`Insumo ${i}`,unidade:"UN"})),
  solicitacoesCompra:[{id:"s-1",obraId:"o-1",status:"enviada",cotacaoIds:[]}],
  cotacoes:[],pedidos:[],fechamentosFinanceiros:[],
});
const command=(type,payload,expectedVersion=0,patch={})=>({
  type,payload,expectedVersion,actorId:"u-1",actorName:"Compras",actorRole:"compras",
  idempotencyKey:`command-${type.toLowerCase()}-${Math.random()}`,...patch,
});
// f-1 é o mais barato nos itens pares, f-2 nos ímpares; f-3 sempre mais caro.
const rawQuote=()=>({
  id:"c-1",obraId:"o-1",solicitacaoId:"s-1",data:"2026-07-28",
  itens:Array.from({length:ITENS},(_,i)=>({id:`ci-${i}`,materialId:`m-${i}`,qtd:2,unidadeRef:"UN"})),
  propostas:[
    {id:"pr-1",fornecedorId:"f-1",prazoDias:5,precos:Object.fromEntries(Array.from({length:ITENS},(_,i)=>[`ci-${i}`,i%2?12:10]))},
    {id:"pr-2",fornecedorId:"f-2",prazoDias:3,precos:Object.fromEntries(Array.from({length:ITENS},(_,i)=>[`ci-${i}`,i%2?10:12]))},
    {id:"pr-3",fornecedorId:"f-3",prazoDias:1,precos:Object.fromEntries(Array.from({length:ITENS},(_,i)=>[`ci-${i}`,15]))},
  ],
});
const saveQuote=(data=base(),quote=rawQuote())=>applyPurchaseOrderCommand(data,command(
  PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote},
),now);
const orders={"f-1":{orderId:"p-1",number:"PC-001"},"f-2":{orderId:"p-2",number:"PC-002"},"f-3":{orderId:"p-3",number:"PC-003"}};
const decide=(data,choices,extra={},version=1,patch={})=>applyPurchaseOrderCommand(data,command(
  PURCHASE_ORDER_COMMAND.QUOTE_MAP_DECIDED,
  {quoteId:"c-1",choices,orders,date:"2026-07-28",...extra},version,patch,
),now);

describe("mapa de cotação com vários itens (C1.3)",()=>{
  it("solicitação de 20 itens vira 1 cotação e um pedido por fornecedor vencedor",()=>{
    const saved=saveQuote();
    expect(saved.ok).toBe(true);
    const quote=saved.data.cotacoes[0];
    expect(quote.itens).toHaveLength(ITENS);
    expect(quote.materialId).toBe("m-0");
    const mapa=mapaDaCotacao(quote);
    expect(mapa.linhas[0].melhorPropostaId).toBe("pr-1");
    expect(mapa.linhas[1].melhorPropostaId).toBe("pr-2");
    const result=decide(saved.data,sugestaoDeEscolhas(quote));
    expect(result.ok).toBe(true);
    expect(result.data.pedidos.map(item=>item.id)).toEqual(["p-1","p-2"]);
    const [p1,p2]=result.data.pedidos;
    expect(p1).toMatchObject({fornecedorId:"f-1",cotacaoId:"c-1",solicitacaoId:"s-1",numero:"PC-001"});
    expect(p1.itens).toHaveLength(10);
    expect(p2.itens).toHaveLength(10);
    expect(p1.itens.every(item=>item.precoUnit===10)).toBe(true);
    expect(p2.itens[0]).toMatchObject({id:"p-2-ci-1",materialId:"m-1",qtd:2,precoUnit:10,cotacaoItemId:"ci-1"});
    const decided=result.data.cotacoes[0];
    expect(decided).toMatchObject({status:"decidida",pedidoIds:["p-1","p-2"],pedidoId:"p-1",version:2});
    // Economia: (15-10) x 2 por item.
    expect(decided.economia).toBe(ITENS*10);
    expect(decided.decisoes["ci-3"]).toMatchObject({propostaId:"pr-2",pedidoId:"p-2"});
    expect(result.data.solicitacoesCompra[0]).toMatchObject({status:"pedido_gerado",pedidoId:"p-1",pedidoIds:["p-1","p-2"]});
  });

  it("exige justificativa por item fora do menor preço e para item com uma só proposta",()=>{
    const saved=saveQuote();
    const choices={...sugestaoDeEscolhas(saved.data.cotacoes[0]),"ci-0":"pr-3"};
    expect(decide(saved.data,choices).reason).toMatch(/não é a mais barata/);
    const ok=decide(saved.data,choices,{justifications:{"ci-0":"Prazo de 1 dia"}});
    expect(ok.ok).toBe(true);
    expect(ok.data.pedidos.find(item=>item.fornecedorId==="f-3").itens).toHaveLength(1);
    expect(ok.data.cotacoes[0].decisoes["ci-0"].justificativa).toBe("Prazo de 1 dia");

    const single=rawQuote();
    single.propostas=single.propostas.map(p=>p.id==="pr-1"?p:{...p,precos:Object.fromEntries(Object.entries(p.precos).filter(([k])=>k!=="ci-0"))});
    const savedSingle=saveQuote(base(),single);
    expect(decide(savedSingle.data,{"ci-0":"pr-1"}).reason).toMatch(/única proposta/);
  });

  it("decide por partes: itens sem escolha ficam pendentes e não se decide o mesmo item duas vezes",()=>{
    const saved=saveQuote();
    const first=decide(saved.data,{"ci-0":"pr-1","ci-2":"pr-1"});
    expect(first.ok).toBe(true);
    expect(first.data.cotacoes[0]).toMatchObject({status:"aberta",pedidoIds:["p-1"]});
    expect(decide(first.data,{"ci-0":"pr-1"},{},2).reason).toMatch(/já virou pedido/);
    const rest=Object.fromEntries(Array.from({length:ITENS},(_,i)=>[`ci-${i}`,i%2?"pr-2":"pr-1"]).filter(([k])=>!["ci-0","ci-2"].includes(k)));
    const second=decide(first.data,rest,{orders:{...orders,"f-1":{orderId:"p-4",number:"PC-004"}}},2);
    expect(second.ok).toBe(true);
    expect(second.data.cotacoes[0]).toMatchObject({status:"decidida",pedidoIds:["p-1","p-2","p-4"]});
    expect(second.data.cotacoes[0].economia).toBe(ITENS*10);
  });

  it("a alçada vale para a soma dos pedidos gerados pelo mapa",()=>{
    const quote=rawQuote();
    quote.itens=quote.itens.map(item=>({...item,qtd:300}));
    const saved=saveQuote(base(),quote);
    // 20 itens x 300 x R$10 = R$ 60.000 divididos entre 2 fornecedores.
    const blocked=decide(saved.data,sugestaoDeEscolhas(saved.data.cotacoes[0]));
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/Administrador/);
    const one=decide(saved.data,{"ci-0":"pr-1"});
    expect(one.ok).toBe(true);
    const admin=decide(saved.data,sugestaoDeEscolhas(saved.data.cotacoes[0]),{},1,{actorRole:"admin"});
    expect(admin.ok).toBe(true);
  });

  it("cancelar um dos pedidos devolve só os itens dele para a cotação",()=>{
    const saved=saveQuote();
    const decided=decide(saved.data,sugestaoDeEscolhas(saved.data.cotacoes[0]));
    const cancelled=applyPurchaseCancellationCommand(decided.data,{
      type:PURCHASE_CANCELLATION_COMMAND.PURCHASE_CANCELLED,idempotencyKey:"cancel-p-2-000001",
      expectedVersion:1,actorId:"u-1",actorName:"Compras",payload:{orderId:"p-2",reason:"Fornecedor sem estoque"},
    },now);
    expect(cancelled.ok).toBe(true);
    const quote=cancelled.data.cotacoes[0];
    expect(quote).toMatchObject({status:"aberta",pedidoIds:["p-1"],pedidoId:"p-1"});
    expect(Object.keys(quote.decisoes)).toHaveLength(10);
    expect(quote.decisoes["ci-1"]).toBeUndefined();
    // A economia acompanha só as decisões que seguem vivas.
    expect(quote.economia).toBe(ITENS*10/2);
    expect(cancelled.data.solicitacoesCompra[0]).toMatchObject({status:"pedido_gerado",pedidoId:"p-1",pedidoIds:["p-1"]});
    // Os itens devolvidos podem ir para outro fornecedor sem o pedido vivo bloquear.
    const again=decide(cancelled.data,{"ci-1":"pr-3"},{justifications:{"ci-1":"Único com estoque"}},quote.version);
    expect(again.ok).toBe(true);
    expect(again.data.pedidos.find(item=>item.id==="p-3").itens).toHaveLength(1);
  });

  it("recusa fornecedor repetido e alteração de item que já virou pedido",()=>{
    const repeated=rawQuote();
    repeated.propostas[2].fornecedorId="f-1";
    expect(saveQuote(base(),repeated).reason).toMatch(/única proposta/);
    const saved=saveQuote();
    const decided=decide(saved.data,{"ci-0":"pr-1"});
    const edited=rawQuote();
    edited.itens[0].qtd=5;
    const result=applyPurchaseOrderCommand(decided.data,command(
      PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote:edited},2,
    ),now);
    expect(result.reason).toMatch(/já virou pedido/);
    const pending=rawQuote();
    pending.itens[1].qtd=5;
    expect(applyPurchaseOrderCommand(decided.data,command(
      PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote:pending},2,
    ),now).ok).toBe(true);
  });

  it("pedidos do mapa sem número recebem a numeração do servidor em sequência",()=>{
    const saved=saveQuote();
    const result=decide(saved.data,sugestaoDeEscolhas(saved.data.cotacoes[0]),{orders:{
      "f-1":{orderId:"p-1",number:""},"f-2":{orderId:"p-2",number:""},
    }});
    expect(result.ok).toBe(true);
    expect(result.data.pedidos.map(item=>item.numero)).toEqual(["PC-0001","PC-0002"]);
  });

  it("cotação antiga de um item continua decidindo pelo mapa",()=>{
    const data=base();
    data.cotacoes=[{id:"c-1",obraId:"o-1",solicitacaoId:"s-1",materialId:"m-0",qtd:2,status:"aberta",version:1,
      unidadeRef:"UN",propostas:[{id:"pr-1",fornecedorId:"f-1",precoUnit:10},{id:"pr-2",fornecedorId:"f-2",precoUnit:12}]}];
    const result=decide(data,{__item:"pr-1"});
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0].itens[0]).toMatchObject({materialId:"m-0",qtd:2,precoUnit:10});
    expect(result.data.cotacoes[0]).toMatchObject({status:"decidida",escolhida:"pr-1",pedidoId:"p-1",economia:4});
  });

  it("cancelar a cotação desfaz o vínculo de todos os pedidos gerados",()=>{
    const saved=saveQuote();
    const decided=decide(saved.data,sugestaoDeEscolhas(saved.data.cotacoes[0]));
    const result=applyPurchaseOrderCommand(decided.data,command(
      PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_CANCELLED,{quoteId:"c-1",reason:"Refazer"},2,
    ),now);
    expect(result.ok).toBe(true);
    expect(result.data.pedidos.every(item=>item.cotacaoId==="")).toBe(true);
  });
});


describe("custo final e alçadas no servidor",()=>{
  const commercialQuote=()=>{const q=rawQuote();q.propostas.forEach(p=>{p.custoFinal={frete:5000,desconto:0,impostos:0,despesas:0};p.condicoesPagamento="30 dias";});return q;};
  const choices=()=>Object.fromEntries(rawQuote().itens.map(i=>[i.id,"pr-1"]));
  const justifications=()=>Object.fromEntries(rawQuote().itens.map(i=>[i.id,"Fornecedor atende a cesta completa"]));
  it("persiste condições e inclui adicionais na alçada conjunta",()=>{
    const saved=saveQuote(base(),commercialQuote());
    expect(saved.ok).toBe(true);
    expect(saved.data.cotacoes[0].propostas[0].custoFinal.frete).toBe(5000);
    const blocked=decide(saved.data,choices(),{justifications:justifications()});
    expect(blocked.ok).toBe(false);expect(blocked.reason).toMatch(/Administrador/);
    const approved=decide(saved.data,choices(),{justifications:justifications()},1,{actorRole:"admin"});
    expect(approved.ok).toBe(true);
    const order=approved.data.pedidos[0];
    expect(order.condicoesPagamento).toBe("30 dias");
    expect(Math.round(order.itens.reduce((sum,i)=>sum+i.precoUnit*i.qtd,0)*100)).toBe(544000);
    expect(order.itens[0].precoUnitCotado).toBe(10);
  });
  it("recusa custos negativos na API e trava alteração comercial de itens decididos",()=>{
    const q=commercialQuote();q.propostas[0].custoFinal.frete=-1;
    expect(saveQuote(base(),q).ok).toBe(false);
    const saved=saveQuote(base(),commercialQuote());
    const approved=decide(saved.data,choices(),{justifications:justifications()},1,{actorRole:"admin"});
    expect(approved.ok).toBe(true);
    const changed={...approved.data.cotacoes[0],propostas:approved.data.cotacoes[0].propostas.map(p=>({...p,custoFinal:{...p.custoFinal,frete:0}}))};
    const result=applyPurchaseOrderCommand(approved.data,command(PURCHASE_ORDER_COMMAND.QUOTATION_SAVED,{quote:changed},changed.version),now);
    expect(result.ok).toBe(false);
  });
});
