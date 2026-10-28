import {describe,expect,it} from "vitest";
import {normalizeArchivedCosts,summarizeArchivedCosts} from "./archived-costs.js";

describe("FIN 9.6 — custo e rateio do ponto arquivado",()=>{
  it("CLT mensal não duplica salário, mas preserva benefício e obra do dia",()=>{
    const summary=summarizeArchivedCosts({
      attendance:{
        e1:{"2026-07-10":{status:"P",obraId:"o2"}},
      },
      employeesSnapshot:[{
        id:"e1",obra:"o1",monthlySalary:3100,
        remunerationMode:"clt",remunerationEffectiveFrom:"2026-01-01",
        dailyRate:100,vtDaily:10,vrDaily:15,workdayHours:8,
        startDate:"2026-01-01",
      }],
    },{});

    expect(summary.byDate["2026-07-10"].o2).toEqual({
      laborCost:0,
      benefitCost:25,
    });
    expect(summary.cltAllocationByDate["2026-07-10"].e1).toEqual({
      obraId:"o2",status:"P",
    });
  });

  it("arquivo antigo completa apenas remuneração pelo cadastro/histórico atual",()=>{
    const summary=summarizeArchivedCosts({
      attendance:{
        e1:{"2026-07-10":{status:"P",obraId:"o2"}},
      },
      employeesSnapshot:[{
        id:"e1",obra:"o1",dailyRate:100,vtDaily:10,workdayHours:8,
        startDate:"2026-01-01",
      }],
    },{},[{
      id:"e1",monthlySalary:3100,remunerationMode:"clt",
      remunerationEffectiveFrom:"2026-01-01",
    }]);

    expect(summary.byDate["2026-07-10"].o2).toMatchObject({
      laborCost:0,benefitCost:10,
    });
    expect(summary.cltAllocationByDate["2026-07-10"].e1.obraId).toBe("o2");
  });

  it("sem obra explícita usa a lotação histórica da data",()=>{
    const summary=summarizeArchivedCosts({
      attendance:{
        e1:{"2026-07-10":{status:"P"}},
      },
      employeesSnapshot:[{
        id:"e1",obra:"o2",dailyRate:100,
        obraHistory:[{date:"2026-07-15",fromObraId:"o1",toObraId:"o2"}],
        startDate:"2026-01-01",
      }],
    },{});

    expect(summary.byDate["2026-07-10"].o1).toMatchObject({laborCost:100});
    expect(summary.byDate["2026-07-10"].o2).toBeUndefined();
  });

  it("normalização preserva somente alocações válidas",()=>{
    expect(normalizeArchivedCosts({
      byDate:{"2026-07-10":{o1:{laborCost:0,benefitCost:10}}},
      cltAllocationByDate:{
        "2026-07-10":{
          e1:{obraId:"o1",status:"P"},
          e2:{obraId:"",status:"P"},
        },
        invalida:{e3:{obraId:"o2",status:"P"}},
      },
    })).toEqual({
      byDate:{"2026-07-10":{o1:{laborCost:0,benefitCost:10}}},
      cltAllocationByDate:{"2026-07-10":{e1:{obraId:"o1",status:"P"}}},
    });
  });
});
