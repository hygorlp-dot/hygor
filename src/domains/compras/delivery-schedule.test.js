import { describe, expect, it } from "vitest";
import {
  atrasoDoItem, entregasAvaliadas, pedidosComItensAtrasados, pontualidadeEntregas, remessasDoItem, validarProgramacaoItem,
} from "./delivery-schedule.js";
import { mapaGerencialCompras } from "./calculations.js";
import { applyPurchaseOrderCommand, PURCHASE_ORDER_COMMAND } from "./purchase-order-commands.js";

// Aço em 3 remessas; cimento com data própria; areia segue a previsão do pedido.
const pedido=()=>({id:"p-1",numero:"PC-0001",obraId:"o-1",fornecedorId:"f-1",status:"parcial",previsao:"2026-10-30",itens:[
  {id:"aco",materialId:"m-aco",qtd:30,qtdRecebida:10,remessas:[
    {id:"r1",data:"2026-10-10",qtd:10},{id:"r2",data:"2026-10-20",qtd:10},{id:"r3",data:"2026-11-05",qtd:10}],
    recebimentos:[{data:"2026-10-12",qtd:10}]},
  {id:"cim",materialId:"m-cim",qtd:5,qtdRecebida:5,previsao:"2026-10-15",recebimentos:[{data:"2026-10-14",qtd:5}]},
  {id:"are",materialId:"m-are",qtd:4,qtdRecebida:0,recebimentos:[]},
]});
const data=()=>({pedidos:[pedido()],materiais:[{id:"m-aco",descricao:"AÇO CA-50",unidade:"KG"},{id:"m-cim",descricao:"CIMENTO",unidade:"SC"},{id:"m-are",descricao:"AREIA",unidade:"M3"}]});

describe("entrega programada por item (C2.2)",()=>{
  it("lê remessas, data própria e previsão do pedido, nessa ordem",()=>{
    const [aco,cim,are]=pedido().itens;
    expect(remessasDoItem(aco,pedido()).map(r=>[r.data,r.acumulado])).toEqual([["2026-10-10",10],["2026-10-20",20],["2026-11-05",30]]);
    expect(remessasDoItem(cim,pedido())).toEqual([{id:"",data:"2026-10-15",qtd:5,acumulado:5}]);
    expect(remessasDoItem(are,pedido())[0].data).toBe("2026-10-30");
    // Remessas que não cobrem tudo: o resto segue a data do item ou do pedido.
    const parcial={qtd:10,previsao:"2026-12-01",remessas:[{data:"2026-11-01",qtd:4}]};
    expect(remessasDoItem(parcial,{}).map(r=>[r.data,r.qtd])).toEqual([["2026-11-01",4],["2026-12-01",6]]);
  });

  it("o atraso olha a remessa vencida do item, não o pedido",()=>{
    const [aco,cim,are]=pedido().itens;
    // Em 23/10 a 2ª remessa do aço (até 20/10) não chegou: 10 KG atrasados há 3 dias.
    expect(atrasoDoItem(aco,pedido(),"2026-10-23")).toMatchObject({atrasada:10,diasAtraso:3,proximaData:"2026-10-20"});
    expect(atrasoDoItem(cim,pedido(),"2026-10-23").atrasada).toBe(0);
    expect(atrasoDoItem(are,pedido(),"2026-10-23")).toMatchObject({atrasada:0,proximaData:"2026-10-30"});
    const atrasados=pedidosComItensAtrasados(data(),"2026-10-23");
    expect(atrasados).toHaveLength(1);
    expect(atrasados[0].itensPendentes).toEqual([{itemId:"aco",descricao:"AÇO CA-50",unidade:"KG",falta:10,dataPrevista:"2026-10-20",diasAtraso:3}]);
    // O pedido antigo (previsão 30/10) não estaria atrasado em 23/10.
    expect(mapaGerencialCompras(data(),[],"2026-10-23").atrasados.map(p=>p.id)).toEqual(["p-1"]);
  });

  it("a pontualidade usa a data de cada remessa",()=>{
    const avaliadas=entregasAvaliadas([pedido()],"2026-10-23");
    // aço r1 no prazo? chegou 12/10 para 10/10 → atrasou 2 dias; aço r2 vencida e pendente; cimento no prazo.
    expect(avaliadas.map(e=>[e.itemId,e.data,e.noPrazo,e.atraso,e.pendente])).toEqual([
      ["aco","2026-10-10",false,2,false],["aco","2026-10-20",false,3,true],["cim","2026-10-15",true,0,false],
    ]);
    expect(Math.round(pontualidadeEntregas([pedido()],"2026-10-23"))).toBe(33);
    expect(mapaGerencialCompras(data(),[],"2026-10-23").pontualidade).toBeCloseTo(100/3);
  });

  it("o servidor valida as datas e a soma das remessas",()=>{
    expect(validarProgramacaoItem({qtd:10,previsao:"30/10"})).toMatch(/data prevista/);
    expect(validarProgramacaoItem({qtd:10,remessas:[{data:"2026-11-01",qtd:0}]})).toMatch(/data e quantidade/);
    expect(validarProgramacaoItem({qtd:10,remessas:[{data:"2026-11-01",qtd:6},{data:"2026-11-02",qtd:5}]})).toMatch(/passa da quantidade/);
    expect(validarProgramacaoItem({qtd:10,remessas:[{data:"2026-11-01",qtd:6}]})).toBe("");
    const base={obras:[{id:"o-1"}],fornecedores:[{id:"f-1",nome:"F"}],materiais:[{id:"m-1",descricao:"Aço"}],pedidos:[],fechamentosFinanceiros:[]};
    const salvar=itens=>applyPurchaseOrderCommand(base,{type:PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SAVED,expectedVersion:0,
      actorId:"u-1",actorName:"Compras",idempotencyKey:"k-entrega-programada-0001",
      payload:{order:{id:"p-1",numero:"PC-1",obraId:"o-1",fornecedorId:"f-1",data:"2026-10-01",previsao:"",status:"enviado",itens}}},
    "2026-10-01T12:00:00.000Z");
    expect(salvar([{id:"i-1",materialId:"m-1",qtd:10,precoUnit:5,remessas:[{data:"2026-11-01",qtd:11}]}]).reason).toMatch(/passa da quantidade/);
    const ok=salvar([{id:"i-1",materialId:"m-1",qtd:10,precoUnit:5,remessas:[{id:"r1",data:"2026-11-01",qtd:4},{id:"r2",data:"2026-11-15",qtd:6}]}]);
    expect(ok.ok).toBe(true);
    expect(ok.data.pedidos[0].itens[0].remessas).toHaveLength(2);
  });
});
