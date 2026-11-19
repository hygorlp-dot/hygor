import { describe, expect, it } from "vitest";
import { buildRequestedDreProjectionRows } from "./dre-projection.js";
import { rebuildArchivedLaborCosts } from "./financial-archived-costs-source.js";
import { archivedCltScenario } from "../src/fixtures/archived-clt.js";
import { payrollDelayWaiverScenario, waivedDelayPayrollTitle } from "../src/fixtures/payroll-delay-waiver.js";

it("DRE reconhece os mesmos R$ 100 da folha fechada sem desconto, inclusive após arquivar",()=>{
  const data=payrollDelayWaiverScenario();
  const closed={...data,titulosFolha:[waivedDelayPayrollTitle]};
  const archived=rebuildArchivedLaborCosts({
    data:{...closed,attendance:{},quinzenasArquivadas:{"2026-11-Q1":{}}},
    archiveRows:[{key:"arced_ponto_v1__arq__2026-11-Q1",value:{
      attendance:data.attendance,employeesSnapshot:data.employees,
    }}],
  }).data;
  const cost=source=>buildRequestedDreProjectionRows(source,[{year:2026,month:10,period:"mes",scope:"obra"}])[0].payload.moData.laborCost;
  expect(cost(data)).toBe(90);
  expect(cost(closed)).toBe(100);
  expect(cost(archived)).toBe(100);
});

it("DRE preserva R$ 2.300 de salário CLT e R$ 25 de benefícios históricos por obra",()=>{
  const {data,archiveRows,live}=archivedCltScenario();
  const archived=rebuildArchivedLaborCosts({data,archiveRows}).data;
  for(const source of [live,archived]){
    const rows=buildRequestedDreProjectionRows(source,[
      {year:2026,month:6,period:"mes",scope:"o1"},
      {year:2026,month:6,period:"mes",scope:"o2"},
    ]);
    expect(rows[0].payload.moData).toMatchObject({laborCost:2200,benefitCost:0,totalCost:2200});
    expect(rows[1].payload.moData).toMatchObject({laborCost:100,benefitCost:25,totalCost:125});
    expect(rows.reduce((sum,row)=>sum+row.payload.moData.laborCost,0)).toBe(2300);
  }
});

// Regressão: server/dre-projection.js reimplementava o cálculo de mão de obra
// do zero (função `laborCost` local) e ignorava `employee.obraHistory` /
// `data.changeLog`, atribuindo o custo do funcionário sempre à obra atual —
// mesmo em datas anteriores a uma transferência. O DRE do servidor divergia
// do motor canônico do cliente (src/domains/financeiro/labor-cost-engine.js),
// que já respeitava o histórico. Corrigido reusando o mesmo motor no servidor.
describe("DRE do servidor — mão de obra após transferência de obra", () => {
  it("atribui o custo à obra correta antes e depois da transferência do funcionário", () => {
    const data = {
      config: {},
      obras: [
        { id: "o1", name: "Obra antiga" },
        { id: "o2", name: "Obra nova" },
      ],
      employees: [{
        id: "e1", obra: "o2", dailyRate: 100,
        obraHistory: [{ date: "2026-07-15", fromObraId: "o1", toObraId: "o2" }],
      }],
      attendance: { e1: {
        "2026-07-10": { status: "P" },
        "2026-07-20": { status: "P" },
      } },
    };

    const [oldWorkRow] = buildRequestedDreProjectionRows(data, [
      { year: 2026, month: 6, period: "mes", scope: "o1" },
    ]);
    const [newWorkRow] = buildRequestedDreProjectionRows(data, [
      { year: 2026, month: 6, period: "mes", scope: "o2" },
    ]);

    // Antes da transferência (10/07): custo pertence à obra antiga.
    expect(oldWorkRow.payload.moData.laborCost).toBe(100);
    // Depois da transferência (20/07): custo pertence à obra nova.
    expect(newWorkRow.payload.moData.laborCost).toBe(100);
  });
});

describe("DRE do servidor — feriado pago pela obra do último dia trabalhado", () => {
  it("o feriado entra na obra onde o funcionário trabalhou no dia anterior, não na lotação", () => {
    const data = {
      config: {},
      obras: [
        { id: "adm", name: "Obra por administração", contractType: "admin_only", adminPercentage: 15 },
        { id: "fixa", name: "Obra de lotação", contractType: "fixed_labor" },
      ],
      employees: [{ id: "e1", obra: "fixa", dailyRate: 100 }],
      attendance: { e1: { "2026-10-09": { status: "P", obraId: "adm" } } },
    };
    const linha = scope => buildRequestedDreProjectionRows(data, [{ year: 2026, month: 9, period: "q1", scope }])[0].payload.moData.laborCost;
    expect(linha("adm")).toBe(200);                                 // 09/10 + feriado de 12/10
    expect(linha("fixa")).toBe(0);
  });
});
