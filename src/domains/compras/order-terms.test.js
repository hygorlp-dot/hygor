import {describe,it,expect} from "vitest";
import {applyPurchaseOrderCommand as apply,PURCHASE_ORDER_COMMAND as C} from "./purchase-order-commands";
import {applyOperationalCommand} from "../sync/operational-commands";
const now="2026-10-30T12:00:00.000Z";
const data=()=>({obras:[{id:"o",name:"Obra original",address:"Endereço atual da obra"}],fornecedores:[{id:"f",nome:"Fornecedor original",cnpj:"123"},{id:"f2",nome:"Segundo fornecedor"}],materiais:[{id:"m"}],pedidos:[],cotacoes:[],config:{}});
const order=()=>({id:"p",numero:"PC-001",obraId:"o",fornecedorId:"f",status:"enviado",data:"2026-10-30",previsao:"2026-11-04",condicoesFaturamento:"Faturar para Cliente A · CPF informado",enderecoEntrega:"Rua acordada, 10",contatoEntrega:"Ana · telefone informado",condicoesEntrega:"Descarregar pela manhã",condicoesPagamento:"30/60 dias",itens:[{id:"i",materialId:"m",qtd:2,precoUnit:10}],origemPagamento:"empresa"});
const cmd=(type,payload,version=0)=>({type,payload,expectedVersion:version,actorId:"u",actorName:"Compras",actorRole:"admin",idempotencyKey:`teste-condicoes-${type}-${version}`});
const save=(d,o=order(),version=0,reason="Condições renegociadas")=>apply(d,cmd(C.PURCHASE_ORDER_SAVED,{order:o,adjustmentReason:reason},version),now);
describe("condições históricas dos pedidos",()=>{
 it("captura o acordo na criação, sem inferir faturamento ou entrega pelos cadastros",()=>{
  const result=save(data(),{...order(),historicoCondicoesPedido:[{versao:999,registradoPor:"Autor forjado"}]});expect(result.ok).toBe(true);const p=result.data.pedidos[0],s=p.historicoCondicoesPedido[0];
  expect(s).toMatchObject({versao:1,origem:"criacao",registradoEm:now,registradoPorId:"u",condicoes:{enderecoEntrega:"Rua acordada, 10",condicoesPagamento:"30/60 dias"},fornecedor:{nome:"Fornecedor original",documento:"123"},obra:{nome:"Obra original"}});
  expect(result.data.transacoes).toBeUndefined();expect(result.data.notasFiscais).toBeUndefined();
  const empty=save(data(),{...order(),condicoesFaturamento:"",enderecoEntrega:""}).data.pedidos[0];
  expect(empty.historicoCondicoesPedido[0].condicoes).toMatchObject({condicoesFaturamento:null,enderecoEntrega:null});
 });
 it("preserva o histórico em edição comum, mudança cadastral e tentativa de substituição",()=>{
  const d=save(data()).data,p=d.pedidos[0],original=structuredClone(p.historicoCondicoesPedido);
  d.fornecedores[0].nome="Cadastro novo";d.obras[0].name="Obra renomeada";
  const r=save(d,{...p,obs:"Observação ajustada",historicoCondicoesPedido:[{versao:999}]},1);
  expect(r.ok).toBe(true);expect(r.data.pedidos[0].historicoCondicoesPedido).toEqual(original);
 });
 it("versiona a renegociação sem reescrever a primeira versão ou atualizar identidades pelo cadastro",()=>{
  const d=save(data()).data,p=d.pedidos[0],before=structuredClone(p.historicoCondicoesPedido[0]);d.fornecedores[0].nome="Cadastro novo";
  const r=save(d,{...p,condicoesFaturamento:"Faturar para Cliente B",enderecoEntrega:"Outro destino",historicoCondicoesPedido:[]},1);
  expect(r.ok).toBe(true);const h=r.data.pedidos[0].historicoCondicoesPedido;expect(h).toHaveLength(2);expect(h[0]).toEqual(before);
  expect(h[1]).toMatchObject({versao:2,origem:"ajuste",motivo:"Condições renegociadas",fornecedor:{nome:"Fornecedor original"},condicoes:{condicoesFaturamento:"Faturar para Cliente B",enderecoEntrega:"Outro destino"}});
  expect(p.historicoCondicoesPedido).toEqual([before]);
 });
 it("mantém pedido legado sem snapshot em ajuste que não altera condições",()=>{
  const d=data(),p={...order(),version:3};delete p.condicoesFaturamento;delete p.enderecoEntrega;d.pedidos=[p];
  const r=save(d,{...p,obs:"Anexo conferido"},3);expect(r.ok).toBe(true);expect(r.data.pedidos[0].historicoCondicoesPedido).toBeUndefined();
 });
 it("registra complemento do legado sem atribuir cadastro atual ao passado",()=>{
  const d=data(),p={...order(),version:3};delete p.condicoesFaturamento;d.pedidos=[p];
  const r=save(d,{...p,condicoesFaturamento:"Condição conferida hoje"},3),h=r.data.pedidos[0].historicoCondicoesPedido;
  expect(h).toHaveLength(2);expect(h[0]).toMatchObject({origem:"legado",condicoes:{condicoesFaturamento:null},fornecedor:{nome:null,documento:null},obra:{nome:null}});
  expect(h[1].condicoes.condicoesFaturamento).toBe("Condição conferida hoje");
 });
 it("aceite com novo prazo conserva a previsão originalmente acordada",()=>{
  const d=save(data()).data;
  const r=apply(d,cmd(C.PURCHASE_ORDER_SUPPLIER_ACCEPTED,{orderId:"p",acceptedBy:"Fornecedor",acceptedAt:"2026-10-30",channel:"telefone",confirmedForecast:"2026-11-07"},1),now);
  expect(r.ok).toBe(true);const p=r.data.pedidos[0];expect(p.previsao).toBe("2026-11-07");
  expect(p.historicoCondicoesPedido.map(s=>s.condicoes.previsao)).toEqual(["2026-11-04","2026-11-07"]);
 });
 it.each([123,{},"x".repeat(1501)])("rejeita condições inválidas: %s",invalid=>{
  expect(save(data(),{...order(),condicoesFaturamento:invalid}).ok).toBe(false);
 });
 it("exige versão e motivo e mantém idempotência nas revisões",()=>{
  const d=save(data()).data,p=d.pedidos[0];expect(save(d,{...p,condicoesPagamento:"À vista"},0).ok).toBe(false);expect(save(d,{...p,condicoesPagamento:"À vista"},1,"").ok).toBe(false);
  const c=cmd(C.PURCHASE_ORDER_SAVED,{order:{...p,condicoesPagamento:"À vista"},adjustmentReason:"Renegociação"},1);
  const once=applyOperationalCommand(d,c,now),twice=applyOperationalCommand(once.data,c,now);expect(twice.ok).toBe(true);expect(twice.data.pedidos[0].historicoCondicoesPedido).toHaveLength(2);
 });
 it.each([false,true])("copia as condições da proposta no caminho de cotação (mapa=%s)",map=>{
  const d=data();d.cotacoes=[{id:"q",obraId:"o",status:"aberta",version:1,materialId:"m",qtd:2,...(map?{itens:[{id:"ci",materialId:"m",qtd:2,unidadeRef:"UN"}]}:{}),propostas:[{id:"a",fornecedorId:"f",precoUnit:10,precos:{ci:10},condicoesPagamento:"30 dias",condicoesFaturamento:"CNPJ acordado",enderecoEntrega:"Destino da proposta",condicoesEntrega:"Com descarga",prazoDias:5},{id:"b",fornecedorId:"f2",precoUnit:12,precos:{ci:12}}]}];
  const c=map?cmd(C.QUOTE_MAP_DECIDED,{quoteId:"q",choices:{ci:"a"},orders:{f:{orderId:"p",number:"PC-001"}}},1):cmd(C.PURCHASE_ORDER_CREATED_FROM_QUOTE,{quoteId:"q",proposalId:"a",orderId:"p",number:"PC-001",itemId:"i"},1);
  const r=apply(d,c,now);expect(r.ok,r.reason).toBe(true);expect(r.data.pedidos[0].historicoCondicoesPedido[0]).toMatchObject({condicoes:{condicoesPagamento:"30 dias",condicoesFaturamento:"CNPJ acordado",enderecoEntrega:"Destino da proposta"},proposta:{cotacaoId:"q",propostaId:"a",prazoDias:5}});
 });
 it("conserva as condições diferentes em pedidos separados por fornecedor",()=>{
  const d=data();d.cotacoes=[{id:"q",obraId:"o",status:"aberta",version:1,itens:[{id:"a",materialId:"m",qtd:1},{id:"b",materialId:"m",qtd:1}],propostas:[{id:"pr1",fornecedorId:"f",precos:{a:10,b:20},enderecoEntrega:"Destino A",condicoesFaturamento:"Destinatário A"},{id:"pr2",fornecedorId:"f2",precos:{a:20,b:10},enderecoEntrega:"Destino B",condicoesFaturamento:"Destinatário B"}]}];
  const r=apply(d,cmd(C.QUOTE_MAP_DECIDED,{quoteId:"q",choices:{a:"pr1",b:"pr2"},orders:{f:{orderId:"p1",number:"PC-001",condicoesFaturamento:"Forjado"},f2:{orderId:"p2",number:"PC-002"}}},1),now);
  expect(r.ok,r.reason).toBe(true);expect(r.data.pedidos.map(p=>p.historicoCondicoesPedido[0].condicoes.enderecoEntrega)).toEqual(["Destino A","Destino B"]);
  const captured=structuredClone(r.data.pedidos[0].historicoCondicoesPedido);r.data.cotacoes[0].propostas[0].enderecoEntrega="Mudou na origem";expect(r.data.pedidos[0].historicoCondicoesPedido).toEqual(captured);
 });
 it("salva condições da cotação com prazo desconhecido explícito, sem converter ausência em zero",()=>{
  const d=data(),q={id:"q",obraId:"o",status:"aberta",materialId:"m",qtd:1,propostas:[{id:"a",fornecedorId:"f",precoUnit:10,condicoesFaturamento:"Destinatário documentado",condicoesEntrega:"Descarga incluída"},{id:"b",fornecedorId:"f2",precoUnit:20}]};
  const r=apply(d,cmd(C.QUOTATION_SAVED,{quote:q}),now);expect(r.ok,r.reason).toBe(true);expect(r.data.cotacoes[0].propostas[0]).toMatchObject({prazoDias:null,condicoesFaturamento:"Destinatário documentado",condicoesEntrega:"Descarga incluída"});
  r.data.cotacoes[0].numero="COT-001";
  const edited=apply(r.data,cmd(C.QUOTATION_SAVED,{quote:{...q,numero:"Número enviado não deve substituir o original"}},1),now);
  expect(edited.ok,edited.reason).toBe(true);expect(edited.data.cotacoes[0].numero).toBe("COT-001");
 });
 it("preserva datas e remessas por item, sem tratar recebimento como renegociação",()=>{
  const o=order();o.itens[0]={...o.itens[0],previsao:"2026-11-04",remessas:[{id:"r",data:"2026-11-02",qtd:1}],unidadeRef:"UN"};
  const d=save(data(),o).data,p=d.pedidos[0];
  const r=save(d,{...p,itens:p.itens.map(i=>({...i,remessas:[{id:"r",data:"2026-11-03",qtd:1}]}))},1);
  expect(r.ok,r.reason).toBe(true);expect(r.data.pedidos[0].historicoCondicoesPedido.map(s=>s.condicoes.entregas[0].remessas[0].data)).toEqual(["2026-11-02","2026-11-03"]);
  const next=r.data;next.pedidos[0].itens[0].qtdRecebida=1;next.pedidos[0].itens[0].recebimentos=[{data:"2026-11-03",qtd:1}];
  const unchanged=save(next,{...next.pedidos[0],obs:"Conferência do recebimento"},2);expect(unchanged.ok).toBe(true);expect(unchanged.data.pedidos[0].historicoCondicoesPedido).toHaveLength(2);
 });
});
