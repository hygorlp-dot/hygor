import {describe,it,expect} from "vitest";
import {ANNUAL_SOURCES,defaultAnnualLayout,validateAnnualRows,saveAnnualLayout,buildAnnualStatement} from "./annual-statement.js";

const month={faturamentoObras:10000,receitaLocacoes:2000,receitaCorporativa:300,descontoLocacoes:100,deducaoISS:200,deducaoPIS:30,deducaoCOFINS:70,
  laborTotal:1000,benefTotal:100,tercTotal:400,rescTotal:50,outrasDiretas:600,repasseEquipamentosTerceiros:300,manutencaoLocacoes:150,totalCSP:2600.01,
  despPorCat:{software:100,tarifas_bancarias:40},totalDespOp:140,provisaoIR:100,provisaoCSLL:50};
describe("DRE anual ajustável",()=>{
  it("particiona todas as fontes uma única vez e impede grupos incompatíveis",()=>{
    const rows=defaultAnnualLayout().rows;
    expect(validateAnnualRows(rows).flatMap(row=>row.sources)).toHaveLength(ANNUAL_SOURCES.length);
    expect(()=>validateAnnualRows([...rows,{id:"duplicate",label:"Outra",group:"revenue",sources:["receitaLocacoes"]}])).toThrow(/única/);
    expect(()=>validateAnnualRows(rows.slice(1))).toThrow(/Todas/);
    expect(()=>validateAnnualRows(rows.map((row,index)=>index===0?{...row,group:"costs"}:row))).toThrow(/incompatível/);
  });
  it("preserva resultado e arredondamento ao agrupar e reordenar linhas",()=>{
    const layout=defaultAnnualLayout(),months=Array(12).fill(month),before=buildAnnualStatement(months,layout);
    const a=layout.rows.find(row=>row.sources.includes("receitaLocacoes")),b=layout.rows.find(row=>row.sources.includes("faturamentoObras"));
    b.sources.push(...a.sources);a.sources=[];layout.rows.reverse();
    const after=buildAnnualStatement(months,layout);
    expect(after.find(row=>row.id==="netProfit")).toEqual(before.find(row=>row.id==="netProfit"));
    expect(after.find(row=>row.id==="netProfit").values[0]).toBe(900999);
    expect(after.find(row=>row.sources?.includes("costResidual")).values[0]).toBe(1);
  });
  it("calcula margem anual ponderada e trata mês sem receita",()=>{
    const result=buildAnnualStatement([{...month}, {...month,faturamentoObras:50000},{}]);
    const net=result.find(row=>row.id==="netProfit"),rev=result.find(row=>row.id==="netRevenue"),margin=result.find(row=>row.id==="netMargin");
    expect(margin.total).toBe(net.total/rev.total*100);expect(margin.values[2]).toBeNull();
  });
  it("preserva o centavo do lucro canônico quando as parcelas arredondadas diferem",()=>{
    const precise={...month,faturamentoTotal:12300.01,totalDeducoes:400.01,lucroLiquido:9010.02};
    expect(buildAnnualStatement([precise]).find(row=>row.id==="netProfit").values[0]).toBe(901002);
  });
  it("salva apenas configuração, preserva pagamentos e protege concorrência e retentativas",()=>{
    const data={payments:[{id:"real",valor:7160}],config:{companyName:"ARCD",version:9}},rows=defaultAnnualLayout().rows;
    const saved=saveAnnualLayout(data,rows,0,{id:"finance"},"2026-10-23");
    expect(saved.data.payments).toBe(data.payments);expect(saved.data.config.companyName).toBe("ARCD");expect(saved.data.config.version).toBe(10);
    expect(saved.layout.version).toBe(1);
    expect(saveAnnualLayout(saved.data,rows,0,{id:"finance"}).unchanged).toBe(true);
    const different=rows.map((row,index)=>index?row:{...row,label:"Novo nome"});
    expect(()=>saveAnnualLayout(saved.data,different,0,{id:"finance"})).toThrow(/outra pessoa/);
  });
});
