import { describe, expect, it } from "vitest";
import { buildDreProjectionRows } from "../server/dre-projection.js";
import { compareDreProjectionRows } from "../server/financial-shadow.js";

describe("projeção canônica do DRE", () => {
  it("consolida receita, recebimento, mão de obra e compras por obra", () => {
    const data={
      config:{paymentHolidays:[]},
      obras:[{id:"o1",name:"Obra 1",contractValue:10000}],
      employees:[{id:"e1",obra:"o1",dailyRate:100,vtDaily:10,vrDaily:20,startDate:"2026-01-01"}],
      attendance:{e1:{"2026-07-06":{status:"P",obraId:"o1"}}},
      medicoes:[{id:"m1",obraId:"o1",competencia:"2026-07",valorPrevisto:1000,recebido:true,valorRecebido:800,dataPagamento:"2026-07-10"}],
      despesasEmpresa:[{id:"d-corp",competencia:"2026-07",data:"2026-07-12",categoria:"aluguel",descricao:"Sede",valor:50,pago:true}],
      payments:[],pagsTerceiros:[],rescisoes:[],outrasDesp:[],
      pedidos:[{id:"p1",obraId:"o1",status:"enviado",data:"2026-07-08",itens:[{qtd:2,precoUnit:50}]}],
      equipamentos:[],locacoesEquip:[],manutencoesEquip:[],
    };
    const rows=buildDreProjectionRows(data);
    const work=rows.find(row=>row.sourceId==="2026-07:mes:o1")?.payload;
    const company=rows.find(row=>row.sourceId==="2026-07:mes:empresa")?.payload;
    const companyStatement=rows.find(row=>row.sourceId==="2026-07:mes:company_dre")?.payload;
    expect(work).toMatchObject({
      faturamento:1000,recebido:800,comprasCost:0,
      moData:{laborCost:100,benefitCost:30,totalCost:130},
      totalCustos:130,lucroBruto:870,
    });
    expect(company).toMatchObject({faturamento:1000,recebido:800,laborCost:100,benefitCost:30,comprasCost:0});
    expect(companyStatement).toMatchObject({
      faturamentoObras:1000,recebidoObras:800,laborTotal:100,benefTotal:30,
      totalCSP:130,lucroBruto:870,totalDespOp:50,ebitda:820,lucroLiquido:820,
      despPorCat:{aluguel:50},
    });
  });

  it("preserva custos arquivados e ignora registros cancelados", () => {
    const data={
      config:{paymentHolidays:[]},obras:[{id:"o1",name:"Obra 1"}],employees:[],attendance:{},
      archivedLaborCosts:{a1:{byDate:{"2026-07-07":{o1:{laborCost:75,benefitCost:15}}}}},
      medicoes:[],payments:[],pagsTerceiros:[],rescisoes:[],equipamentos:[],locacoesEquip:[],manutencoesEquip:[],
      outrasDesp:[{id:"d1",obraId:"o1",competencia:"2026-07",valor:900,status:"cancelado"}],
      pedidos:[],
    };
    const work=buildDreProjectionRows(data).find(row=>row.sourceId==="2026-07:mes:o1")?.payload;
    expect(work.moData).toEqual({laborCost:75,benefitCost:15,totalCost:90});
    expect(work.outrasTotal).toBe(0);
    expect(work.totalCustos).toBe(90);
  });

  it("detecta qualquer divergência entre a projeção e o razão", () => {
    const expected=[{sourceId:"2026-07:mes:o1",payload:{faturamento:1000,moData:{laborCost:100}}}];
    const matching=[{source_id:"2026-07:mes:o1",event_type:"dre_snapshot",payload:{active:true,faturamento:1000,moData:{laborCost:100}}}];
    expect(compareDreProjectionRows(expected,matching)).toEqual([]);
    const divergent=structuredClone(matching);
    divergent[0].payload.moData.laborCost=99;
    expect(compareDreProjectionRows(expected,divergent)).toMatchObject([
      {sourceId:"2026-07:mes:o1",path:"moData.laborCost",difference:-1},
    ]);
  });
});
