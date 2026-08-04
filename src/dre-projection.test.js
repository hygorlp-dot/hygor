import { describe, expect, it } from "vitest";
import { buildDreProjectionRows, buildRequestedDreProjectionRows } from "../server/dre-projection.js";
import { compareDreProjectionRows } from "../server/financial-shadow.js";

describe("projeção canônica do DRE", () => {
  it("materializa somente os períodos solicitados pela consulta", () => {
    const data={
      config:{paymentHolidays:[]},obras:[{id:"o1",name:"Obra 1"}],
      employees:[],attendance:{},medicoes:[],payments:[],pagsTerceiros:[],
      rescisoes:[],outrasDesp:[],pedidos:[],despesasEmpresa:[],
      equipamentos:[],locacoesEquip:[],manutencoesEquip:[],
    };
    const rows=buildRequestedDreProjectionRows(data,[
      {year:2026,month:6,period:"mes",scope:"company_dre"},
      {year:2026,month:5,period:"mes",scope:"company_dre"},
      {year:2026,month:6,period:"mes",scope:"company_dre"},
    ]);
    expect(rows.map(row=>row.sourceId)).toEqual([
      "2026-07:mes:company_dre",
      "2026-06:mes:company_dre",
    ]);
    expect(rows[0].payload).toMatchObject({
      ym:"2026-07",faturamentoObras:0,totalCSP:0,lucroLiquido:0,
    });
  });

  it("consolida receita, recebimento, mão de obra e compras por obra", () => {
    const data={
      config:{paymentHolidays:[]},
      obras:[{id:"o1",name:"Obra 1",contractValue:10000}],
      employees:[{id:"e1",obra:"o1",dailyRate:100,vtDaily:10,vrDaily:20,startDate:"2026-01-01"}],
      attendance:{e1:{"2026-07-06":{status:"P",obraId:"o1",ot:2}}},
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
      moData:{laborCost:137.5,benefitCost:30,totalCost:167.5},
      totalCustos:167.5,lucroBruto:832.5,
    });
    expect(company).toMatchObject({faturamento:1000,recebido:800,laborCost:137.5,benefitCost:30,comprasCost:0});
    expect(companyStatement).toMatchObject({
      faturamentoObras:1000,recebidoObras:800,laborTotal:137.5,benefTotal:30,
      totalCSP:167.5,lucroBruto:832.5,totalDespOp:50,ebitda:782.5,lucroLiquido:782.5,
      despPorCat:{aluguel:50},
    });
  });

  it("apresenta a receita e o custo das locações separadamente no DRE empresarial", () => {
    const data={
      config:{paymentHolidays:[]},obras:[{id:"o1",name:"Obra 1"}],employees:[],attendance:{},
      medicoes:[{id:"m1",obraId:"o1",competencia:"2026-07",valorPrevisto:1000}],
      payments:[],pagsTerceiros:[],rescisoes:[],outrasDesp:[],pedidos:[],despesasEmpresa:[],
      equipamentos:[{id:"e1",quantidadeTotal:1,proprietarioId:"",custoDiaria:20}],
      locacoesEquip:[{id:"l1",equipamentoId:"e1",obraId:"o1",inicio:"2026-07-01",fim:"2026-07-01",quantidade:1,valorDiaria:100,status:"encerrada"}],
      manutencoesEquip:[],
    };
    const statement=buildDreProjectionRows(data)
      .find(row=>row.sourceId==="2026-07:mes:company_dre")?.payload;
    expect(statement).toMatchObject({
      faturamentoObras:1000,receitaLocacoes:100,faturamentoTotal:1100,
    });
    expect(statement.custoLocacoes).toBeGreaterThanOrEqual(0);
    expect(statement.receitaLiquida-statement.totalCSP-statement.totalDespOp).toBe(statement.ebitda);
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

  it("mantém a diária histórica quando uma quinzena arquivada é restaurada",()=>{
    const data={
      config:{paymentHolidays:[]},obras:[{id:"o1",name:"Obra 1"}],
      employees:[{id:"e1",obra:"o1",dailyRate:250,vtDaily:30,vrDaily:30,startDate:"2026-01-01"}],
      attendance:{e1:{"2026-07-07":{status:"P",obraId:"o1",archivedDailyRate:100,archivedVtDaily:10,archivedVrDaily:20}}},
      medicoes:[],payments:[],pagsTerceiros:[],rescisoes:[],outrasDesp:[],pedidos:[],equipamentos:[],locacoesEquip:[],manutencoesEquip:[],
    };
    const work=buildDreProjectionRows(data).find(row=>row.sourceId==="2026-07:mes:o1")?.payload;
    expect(work.moData).toEqual({laborCost:100,benefitCost:30,totalCost:130});
  });

  it("leva o desconto auditável de atraso para a obra e a empresa",()=>{
    const data={
      config:{paymentHolidays:[]},obras:[{id:"o1",name:"Obra 1"}],
      employees:[{id:"e1",obra:"o1",dailyRate:80,vtDaily:10,vrDaily:20,workdayHours:8,workStart:"07:00",startDate:"2026-01-01"}],
      attendance:{e1:{"2026-07-08":{status:"P",obraId:"o1",entrada:"07:30",saida:"16:30",workedMinutes:540,atrasoMin:30}}},
      medicoes:[],payments:[],pagsTerceiros:[],rescisoes:[],outrasDesp:[],pedidos:[],equipamentos:[],locacoesEquip:[],manutencoesEquip:[],
    };
    const rows=buildDreProjectionRows(data);
    const work=rows.find(row=>row.sourceId==="2026-07:mes:o1")?.payload;
    const company=rows.find(row=>row.sourceId==="2026-07:mes:empresa")?.payload;
    expect(work.moData).toEqual({laborCost:75,benefitCost:30,totalCost:105});
    expect(company).toMatchObject({laborCost:75,benefitCost:30});
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
