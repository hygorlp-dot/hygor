import { createDreCalculations } from "../domains/dre/calculations.js";

// Massa mínima, determinística e sem dados reais. Ela representa duas obras
// no mesmo mês, com recebimento parcial, receita avulsa, custos diretos e
// overhead corporativo — exatamente os casos que mais expõem dupla contagem.
export const financialReference = Object.freeze({
  year: 2026, month: 6,
  data: {
    obras:[{id:"obra-a",name:"Obra A",contractValue:10000},{id:"obra-b",name:"Obra B",contractValue:6000}],
    medicoes:[
      {id:"med-a",obraId:"obra-a",competencia:"2026-07",valorPrevisto:4000,recebido:true,valorRecebido:2500,dataPagamento:"2026-07-10"},
      {id:"med-b",obraId:"obra-b",competencia:"2026-07",valorPrevisto:2000,recebido:false,valorRecebido:0},
    ],
    payments:[{id:"rec-a",obraId:"obra-a",date:"2026-07-20",amount:500}],
    rescisoes:[{id:"resc-a",obraName:"Obra A",demissao:"2026-07-15",totalLiquido:100}],
    outrasDesp:[{id:"desp-a",obraId:"obra-a",competencia:"2026-07",valor:300},{id:"desp-b",obraId:"obra-b",competencia:"2026-07",valor:200}],
  },
  labor:{"obra-a":{laborCost:1000,benefitCost:100},"obra-b":{laborCost:500,benefitCost:50}},
  terc:{"obra-a":200,"obra-b":100}, compras:{"obra-a":400,"obra-b":300}, equipamento:{"obra-a":100,"obra-b":50},
});

export const financialGoldenExpected = Object.freeze({
  obraA:{faturamento:4000,recebido:3000,aReceber:1500,totalCustos:1600,lucroBruto:2400,saldoCaixa:3000,backlog:6000},
  obraB:{faturamento:2000,recebido:0,aReceber:2000,totalCustos:800,lucroBruto:1200,saldoCaixa:0,backlog:4000},
  consolidado:{faturamento:6100,recebido:3000,aReceber:3500,totalCustos:2400,lucroBruto:3700,saldoCaixa:3000,backlog:10000},
});

export const createFinancialGoldenRules = () => createDreCalculations({
  getDays:()=>["2026-07-01","2026-07-31"],getQ:()=>({q1:["2026-07-01","2026-07-15"],q2:["2026-07-16","2026-07-31"]}),monthName:()=>"Jul",
  calcObraLaborCost:(_,obraId)=>financialReference.labor[obraId]||{laborCost:0,benefitCost:0},
  calcObraTercCost:(_,obraId)=>financialReference.terc[obraId]||0,
  calcTercEmpresaCost:()=>75,calcObraTercEmpresaCost:()=>0,
  calcObraComprasCost:(_,obraId)=>financialReference.compras[obraId]||0,
  calcEquipCustoObra:(_,obraId)=>financialReference.equipamento[obraId]||0,
  calcEquipFaturamentoEmpresa:()=>({receita:150,lucro:100}),
});
