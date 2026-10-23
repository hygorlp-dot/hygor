import { describe, expect, it } from "vitest";
import { alertaOrcamento, alertasOrcamentoDoPedido, calcOrcadoComprado } from "./budget-tracking.js";

// Fundação orçada em R$ 10.000; Estrutura em R$ 20.000.
const data=()=>({
  budgetBaselines:[{obraId:"o-1",tipo:"controle",ativo:true,budgetId:"orc-1"}],
  orcamentos:[{id:"orc-1",obraId:"o-1",
    etapas:[{id:"fund",nome:"Fundação",ordem:1},{id:"fund-sub",nome:"Sapatas",parentId:"fund"},{id:"estr",nome:"Estrutura",ordem:2}],
    itens:[{id:"a",etapaId:"fund-sub",quantidade:100,precoUnit:100},{id:"b",etapaId:"estr",quantidade:1,precoUnit:20000}]}],
  materiais:[{id:"m-aco",descricao:"Aço",unidade:"KG",precoMedio:8}],
  pedidos:[
    {id:"p-1",obraId:"o-1",status:"recebido",itens:[{id:"1",orcNivel1Id:"fund",qtd:50,precoUnit:100,qtdRecebida:50}]},
    {id:"p-2",obraId:"o-1",status:"enviado",itens:[{id:"2",orcNivel1Id:"fund-sub",qtd:20,precoUnit:100,qtdRecebida:0}]},
    {id:"p-3",obraId:"o-1",status:"rascunho",itens:[{id:"3",orcNivel1Id:"estr",qtd:10,precoUnit:100}]},
    {id:"p-4",obraId:"o-1",status:"cancelado",itens:[{id:"4",orcNivel1Id:"estr",qtd:999,precoUnit:100}]},
    {id:"p-5",obraId:"o-1",status:"enviado",itens:[{id:"5",qtd:3,precoUnit:100}]},
  ],
});

describe("orçado × comprometido × realizado (C3.2)",()=>{
  it("separa comprometido (pedido enviado), recebido e rascunho por etapa",()=>{
    const r=calcOrcadoComprado(data(),"o-1");
    const fund=r.linhas.find(l=>l.it.id==="fund"),estr=r.linhas.find(l=>l.it.id==="estr");
    expect(fund).toMatchObject({orcado:10000,comprometido:7000,recebido:5000,previsto:0,saldo:3000,alerta:"ok"});
    expect(estr).toMatchObject({orcado:20000,comprometido:0,previsto:1000,alerta:"ok"});
    expect(r.semApropriacao).toBe(300);
  });

  it("alerta a partir de 90% e acima de 100%",()=>{
    expect(alertaOrcamento(8999,10000)).toBe("ok");
    expect(alertaOrcamento(9000,10000)).toBe("atencao");
    expect(alertaOrcamento(10000,10000)).toBe("atencao");
    expect(alertaOrcamento(10000.02,10000)).toBe("estourou");
    expect(alertaOrcamento(50,0)).toBe("estourou");
  });

  it("o pedido em edição mostra antes de salvar a etapa que passa de 90% ou estoura",()=>{
    const novo=qtd=>({id:"",obraId:"o-1",status:"rascunho",itens:[{id:"n",orcNivel1Id:"fund",qtd,precoUnit:100}]});
    expect(alertasOrcamentoDoPedido(data(),novo(10))).toEqual([]);
    expect(alertasOrcamentoDoPedido(data(),novo(25))).toEqual([{etapaId:"fund",descricao:"Fundação",orcado:10000,antes:7000,depois:9500,pct:95,alerta:"atencao"}]);
    expect(alertasOrcamentoDoPedido(data(),novo(40))[0]).toMatchObject({alerta:"estourou",depois:11000});
    // Editar o próprio pedido não soma duas vezes.
    expect(alertasOrcamentoDoPedido(data(),{...data().pedidos[1],itens:[{id:"2",orcNivel1Id:"fund",qtd:25,precoUnit:100}]})).toEqual([]);
    expect(alertasOrcamentoDoPedido(data(),{...data().pedidos[1],itens:[{id:"2",orcNivel1Id:"fund",qtd:45,precoUnit:100}]})[0]).toMatchObject({antes:5000,depois:9500,alerta:"atencao"});
  });

  it("item sem preço usa o custo médio do insumo",()=>{
    const d=data();
    d.pedidos.push({id:"p-6",obraId:"o-1",status:"enviado",itens:[{id:"6",materialId:"m-aco",orcNivel1Id:"estr",qtd:100,precoUnit:0,unidadeRef:"KG",unidadeCompra:"KG"}]});
    expect(calcOrcadoComprado(d,"o-1").linhas.find(l=>l.it.id==="estr").comprometido).toBe(800);
  });
});
