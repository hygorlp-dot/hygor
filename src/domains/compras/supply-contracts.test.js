import { describe, expect, it } from "vitest";
import {
  applySupplyContractCommand, contratosDisponiveis, resumoContrato, saldoItemContrato, SUPPLY_CONTRACT_COMMAND,
} from "./supply-contracts.js";
import { applyPurchaseOrderCommand, PURCHASE_ORDER_COMMAND } from "./purchase-order-commands.js";
import { applyPurchaseCancellationCommand, PURCHASE_CANCELLATION_COMMAND } from "./purchase-cancellation-command.js";
import { mapaGerencialCompras } from "./calculations.js";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "../sync/operational-commands.js";
import { authorizeOperationalCommand } from "../../../api/data.js";
import { validateOperationalCommandScope } from "../../../server/operational-command-policy.js";

const now="2026-10-23T12:00:00.000Z";
const base=()=>({obras:[{id:"o-1"},{id:"o-2"}],fornecedores:[{id:"f-1",nome:"Concreteira"},{id:"f-2",nome:"Outra"}],
  materiais:[{id:"m-conc",descricao:"CONCRETO 30 MPA",unidade:"M3"},{id:"m-aco",descricao:"AÇO",unidade:"KG"}],
  pedidos:[],cotacoes:[],contratosFornecimento:[],fechamentosFinanceiros:[]});
const cmd=(type,payload,expectedVersion=0,patch={})=>({type,payload,expectedVersion,actorId:"u-1",actorName:"Compras",actorRole:"compras",
  idempotencyKey:`k-${type}-${Math.random().toString(36).slice(2)}-000000`,...patch});
const contrato=(patch={})=>({id:"c-1",fornecedorId:"f-1",obraId:"",vigenciaInicio:"2026-10-01",vigenciaFim:"2027-03-31",
  itens:[{id:"ci-1",materialId:"m-conc",unidadeRef:"M3",precoUnit:520,qtdContratada:100}],...patch});
const comContrato=()=>applySupplyContractCommand(base(),cmd(SUPPLY_CONTRACT_COMMAND.SUPPLY_CONTRACT_SAVED,{contract:contrato()}),now).data;
const pedido=(patch={},item={})=>({id:"p-1",numero:"",obraId:"o-1",fornecedorId:"f-1",data:"2026-10-23",previsao:"",status:"enviado",
  itens:[{id:"i-1",materialId:"m-conc",qtd:30,precoUnit:520,unidadeRef:"M3",contratoId:"c-1",contratoItemId:"ci-1",...item}],...patch});
// Perfil admin: a alçada de aprovação (C1.1) não é o que se testa aqui.
const salvarPedido=(data,order,version=0)=>applyPurchaseOrderCommand(data,cmd(PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SAVED,{order,adjustmentReason:"ajuste"},version,{actorRole:"admin"}),now);

describe("contratos de fornecimento (C2.4)",()=>{
  it("pedido pelo contrato sai sem cotação e baixa o saldo",()=>{
    const data=comContrato();
    expect(data.contratosFornecimento[0]).toMatchObject({numero:"CF-0001",status:"ativo",version:1});
    const salvo=salvarPedido(data,pedido());
    expect(salvo.ok).toBe(true);
    const c=salvo.data.contratosFornecimento[0];
    expect(saldoItemContrato(salvo.data,c,"ci-1")).toBe(70);
    expect(resumoContrato(salvo.data,c).itens[0]).toMatchObject({consumido:30,saldo:70,percentual:30});
    // Não conta como "pedido sem concorrência".
    expect(mapaGerencialCompras(salvo.data,[],"2026-10-23").semCotacao).toHaveLength(0);
    expect(mapaGerencialCompras(salvarPedido(data,pedido({},{contratoId:"",contratoItemId:""})).data,[],"2026-10-23").semCotacao).toHaveLength(1);
  });

  it("recusa preço acima do acordado, saldo insuficiente, outro fornecedor, outra obra e fora da vigência",()=>{
    const data=comContrato();
    expect(salvarPedido(data,pedido({},{precoUnit:530})).reason).toMatch(/acordado/);
    expect(salvarPedido(data,pedido({},{precoUnit:500})).ok).toBe(true);
    expect(salvarPedido(data,pedido({},{qtd:101})).reason).toMatch(/saldo/);
    expect(salvarPedido(data,pedido({fornecedorId:"f-2"})).reason).toMatch(/outro fornecedor/);
    expect(salvarPedido(data,pedido({data:"2027-04-01"})).reason).toMatch(/vigência/);
    expect(salvarPedido(data,pedido({},{materialId:"m-aco"})).reason).toMatch(/não pertence/);
    const daObra=applySupplyContractCommand(base(),cmd(SUPPLY_CONTRACT_COMMAND.SUPPLY_CONTRACT_SAVED,{contract:contrato({obraId:"o-2"})}),now).data;
    expect(salvarPedido(daObra,pedido()).reason).toMatch(/outra obra/);
    // Dois itens do mesmo contrato somam contra o saldo.
    const dois=pedido({itens:[
      {id:"i-1",materialId:"m-conc",qtd:60,precoUnit:520,unidadeRef:"M3",contratoId:"c-1",contratoItemId:"ci-1"},
      {id:"i-2",materialId:"m-conc",qtd:50,precoUnit:520,unidadeRef:"M3",contratoId:"c-1",contratoItemId:"ci-1"}]});
    expect(salvarPedido(data,dois).reason).toMatch(/saldo/);
  });

  it("rascunho não consome saldo do contrato; ao virar enviado o saldo é conferido de novo (D-D)",()=>{
    let data=comContrato();
    const a=salvarPedido(data,pedido({id:"p-a",numero:"PC-A",status:"rascunho"},{id:"i-a",qtd:60}));
    expect(a.ok).toBe(true);
    data=a.data;
    const b=salvarPedido(data,pedido({id:"p-b",numero:"PC-B",status:"rascunho"},{id:"i-b",qtd:60}));
    expect(b.ok).toBe(true);
    data=b.data;
    // os dois rascunhos juntos passam do contrato (120 > 100), mas nenhum consumiu nada ainda
    expect(saldoItemContrato(data,data.contratosFornecimento[0],"ci-1")).toBe(100);
    const enviaA=salvarPedido(data,{...data.pedidos.find(p=>p.id==="p-a"),status:"enviado"},1);
    expect(enviaA.ok).toBe(true);
    expect(saldoItemContrato(enviaA.data,enviaA.data.contratosFornecimento[0],"ci-1")).toBe(40);
    const enviaB=salvarPedido(enviaA.data,{...enviaA.data.pedidos.find(p=>p.id==="p-b"),status:"enviado"},1);
    expect(enviaB.ok).toBe(false);
    expect(enviaB.reason).toMatch(/saldo/);
  });

  it("cancelar o pedido devolve o saldo; editar o próprio pedido não conta duas vezes",()=>{
    const salvo=salvarPedido(comContrato(),pedido());
    const editado=salvarPedido(salvo.data,{...salvo.data.pedidos[0],itens:[{...salvo.data.pedidos[0].itens[0],qtd:90}]},1);
    expect(editado.ok).toBe(true);
    expect(saldoItemContrato(editado.data,editado.data.contratosFornecimento[0],"ci-1")).toBe(10);
    const cancelado=applyPurchaseCancellationCommand(editado.data,{type:PURCHASE_CANCELLATION_COMMAND.PURCHASE_CANCELLED,
      idempotencyKey:"cancel-contrato-000001",expectedVersion:2,actorId:"u-1",actorName:"Compras",payload:{orderId:"p-1",reason:"Erro"}},now);
    expect(cancelado.ok).toBe(true);
    expect(saldoItemContrato(cancelado.data,cancelado.data.contratosFornecimento[0],"ci-1")).toBe(100);
  });

  it("contrato encerrado não aceita pedido novo nem edição; item usado não sai do contrato",()=>{
    const salvo=salvarPedido(comContrato(),pedido());
    const reduzir=applySupplyContractCommand(salvo.data,cmd(SUPPLY_CONTRACT_COMMAND.SUPPLY_CONTRACT_SAVED,
      {contract:contrato({itens:[{id:"ci-1",materialId:"m-conc",unidadeRef:"M3",precoUnit:520,qtdContratada:20}]})},1),now);
    expect(reduzir.reason).toMatch(/abaixo do já pedido/);
    const tirar=applySupplyContractCommand(salvo.data,cmd(SUPPLY_CONTRACT_COMMAND.SUPPLY_CONTRACT_SAVED,
      {contract:contrato({itens:[{id:"ci-2",materialId:"m-aco",unidadeRef:"KG",precoUnit:8,qtdContratada:20}]})},1),now);
    expect(tirar.reason).toMatch(/não pode sair/);
    expect(applySupplyContractCommand(salvo.data,cmd(SUPPLY_CONTRACT_COMMAND.SUPPLY_CONTRACT_CLOSED,{contractId:"c-1"},1),now).reason).toMatch(/motivo/);
    const encerrado=applySupplyContractCommand(salvo.data,cmd(SUPPLY_CONTRACT_COMMAND.SUPPLY_CONTRACT_CLOSED,{contractId:"c-1",reason:"Fim da obra"},1),now);
    expect(encerrado.data.contratosFornecimento[0]).toMatchObject({status:"encerrado",motivoEncerramento:"Fim da obra",version:2});
    expect(salvarPedido(encerrado.data,pedido({id:"p-2"},{id:"i-9"})).reason).toMatch(/encerrado/);
    // O pedido antigo continua editável sem aumentar quantidade/preço.
    expect(salvarPedido(encerrado.data,{...encerrado.data.pedidos[0],previsao:"2026-11-01"},1).ok).toBe(true);
    expect(contratosDisponiveis(encerrado.data,{fornecedorId:"f-1",obraId:"o-1",dataPedido:"2026-10-23"})).toHaveLength(0);
  });

  it("valida o contrato e só Administração e Compras alteram",()=>{
    const salvar=c=>applySupplyContractCommand(base(),cmd(SUPPLY_CONTRACT_COMMAND.SUPPLY_CONTRACT_SAVED,{contract:c}),now);
    expect(salvar(contrato({vigenciaFim:"2026-09-01"})).reason).toMatch(/vigência/);
    expect(salvar(contrato({itens:[{id:"a",materialId:"m-conc",precoUnit:0,qtdContratada:1}]})).reason).toMatch(/preço/);
    expect(salvar(contrato({itens:[{id:"a",materialId:"m-conc",precoUnit:1,qtdContratada:1},{id:"b",materialId:"m-conc",precoUnit:1,qtdContratada:1}]})).reason).toMatch(/uma vez/);
    expect(salvar(contrato({fornecedorId:"x"})).reason).toMatch(/fornecedor/);
    const viaApp=applyOperationalCommand(base(),cmd(OPERATIONAL_COMMAND.SUPPLY_CONTRACT_SAVED,{contract:contrato()}),now);
    expect(viaApp.ok).toBe(true);
    for(const role of ["financeiro","engenheiro","rh"]){
      expect(authorizeOperationalCommand(OPERATIONAL_COMMAND.SUPPLY_CONTRACT_SAVED,role)).toMatchObject({ok:false,status:403});
    }
    expect(authorizeOperationalCommand(OPERATIONAL_COMMAND.SUPPLY_CONTRACT_SAVED,"compras").ok).toBe(true);
    expect(validateOperationalCommandScope({user:{role:"compras",obraId:"o-1"},data:base(),
      command:{type:OPERATIONAL_COMMAND.SUPPLY_CONTRACT_CLOSED,payload:{contractId:"c-1"}}}).ok).toBe(true);
    expect(validateOperationalCommandScope({user:{role:"engenheiro"},data:base(),
      command:{type:OPERATIONAL_COMMAND.SUPPLY_CONTRACT_CLOSED,payload:{}}}).ok).toBe(false);
  });
});
