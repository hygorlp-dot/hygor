import { describe, expect, it } from "vitest";
import { alertaOrcamento, alertasOrcamentoDoPedido, calcOrcadoComprado, segmentosBarraOrcamento } from "./budget-tracking.js";

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

describe("orçado × comprado em ordem de risco, com o detalhe dos pedidos (R2)",()=>{
  // Três etapas: Pintura estoura 2.000% (R$ 100 orçados), Estrutura estoura 5%
  // com valor muito maior, Fundação chega a 95% e Cobertura fica em 10%.
  const cenario=()=>({
    budgetBaselines:[{obraId:"o-1",tipo:"controle",ativo:true,budgetId:"orc-1"}],
    orcamentos:[{id:"orc-1",obraId:"o-1",
      etapas:[{id:"fund",nome:"Fundação",ordem:1},{id:"estr",nome:"Estrutura",ordem:2},{id:"cob",nome:"Cobertura",ordem:3},{id:"pint",nome:"Pintura",ordem:4}],
      itens:[{id:"a",etapaId:"fund",quantidade:1,precoUnit:10000},{id:"b",etapaId:"estr",quantidade:1,precoUnit:100000},
        {id:"c",etapaId:"cob",quantidade:1,precoUnit:10000},{id:"d",etapaId:"pint",quantidade:1,precoUnit:100}]}],
    pedidos:[
      {id:"p-1",numero:"PC-0001",fornecedorId:"f-1",obraId:"o-1",status:"enviado",itens:[{id:"1",orcNivel1Id:"estr",qtd:1,precoUnit:105000}]},
      {id:"p-2",numero:"PC-0002",fornecedorId:"f-2",obraId:"o-1",status:"enviado",itens:[
        {id:"2",orcNivel1Id:"fund",qtd:1,precoUnit:6000},{id:"3",orcNivel1Id:"pint",qtd:1,precoUnit:2000},{id:"4",orcNivel1Id:"fund",qtd:1,precoUnit:500}]},
      {id:"p-3",numero:"PC-0003",fornecedorId:"f-1",obraId:"o-1",status:"recebido",itens:[{id:"5",orcNivel1Id:"fund",qtd:1,precoUnit:3000}]},
      {id:"p-4",numero:"PC-0004",fornecedorId:"f-3",obraId:"o-1",status:"rascunho",itens:[{id:"6",orcNivel1Id:"fund",qtd:1,precoUnit:9000}]},
      {id:"p-5",numero:"PC-0005",fornecedorId:"f-3",obraId:"o-1",status:"enviado",itens:[{id:"7",orcNivel1Id:"cob",qtd:1,precoUnit:1000}]},
      {id:"p-6",numero:"PC-0006",fornecedorId:"f-3",obraId:"o-1",status:"cancelado",itens:[{id:"8",orcNivel1Id:"cob",qtd:1,precoUnit:90000}]},
    ],
  });

  it("o maior estouro percentual vem primeiro, depois atenção e por fim o resto",()=>{
    const ids=calcOrcadoComprado(cenario(),"o-1").linhas.map(l=>[l.it.id,l.alerta,Math.round(l.pct)]);
    expect(ids).toEqual([["pint","estourou",2000],["estr","estourou",105],["fund","atencao",95],["cob","ok",10]]);
  });

  it("cada etapa lista os pedidos que a compõem, com o valor na etapa; rascunho aparece separado e cancelado não aparece",()=>{
    const linhas=calcOrcadoComprado(cenario(),"o-1").linhas;
    const fund=linhas.find(l=>l.it.id==="fund");
    expect(fund.pedidos.map(p=>[p.numero,p.valor,p.rascunho])).toEqual([["PC-0002",6500,false],["PC-0003",3000,false],["PC-0004",9000,true]]);
    expect(fund.pedidos[0]).toMatchObject({id:"p-2",fornecedorId:"f-2",status:"enviado"});
    expect(linhas.find(l=>l.it.id==="pint").pedidos.map(p=>[p.numero,p.valor])).toEqual([["PC-0002",2000]]);
    expect(linhas.find(l=>l.it.id==="cob").pedidos.map(p=>p.numero)).toEqual(["PC-0005"]);
    // A soma dos pedidos vivos da etapa é o comprometido mostrado.
    linhas.forEach(l=>expect(l.pedidos.filter(p=>!p.rascunho).reduce((s,p)=>s+p.valor,0)).toBeCloseTo(l.comprometido,2));
  });

  it("a barra é proporcional à gravidade: o excesso ocupa a fração que passou do orçado",()=>{
    expect(segmentosBarraOrcamento(50)).toEqual({dentro:50,excesso:0,marcaOrcado:100});
    expect(segmentosBarraOrcamento(100)).toEqual({dentro:100,excesso:0,marcaOrcado:100});
    const leve=segmentosBarraOrcamento(105),grave=segmentosBarraOrcamento(2000);
    expect(leve.excesso).toBeCloseTo(4.76,2);
    expect(grave.excesso).toBeCloseTo(95,2);
    expect(leve.dentro+leve.excesso).toBeCloseTo(100,6);
    expect(segmentosBarraOrcamento(-3)).toEqual({dentro:0,excesso:0,marcaOrcado:100});
  });
});
