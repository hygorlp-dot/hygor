import {describe,expect,it} from "vitest";
import {rebuildArchivedLaborCosts} from "./financial-archived-costs-source.js";

describe("FIN 9.6 — custos arquivados vêm dos arquivos imutáveis",()=>{
  const data={
    config:{laborCharges:{diaria:10}},
    quinzenasArquivadas:{
      "2026-07-Q1":{inicio:"2026-07-01",fim:"2026-07-15"},
    },
    archivedLaborCosts:{
      "2026-07-Q1":{byDate:{"2026-07-10":{o1:{laborCost:999,benefitCost:999}}}},
    },
  };
  const rows=[{
    key:"arced_ponto_v1__arq__2026-07-Q1",
    value:{
      attendance:{e1:{"2026-07-10":{status:"P",obraId:"o1"}}},
      employeesSnapshot:[{
        id:"e1",name:"Operário",obra:"o1",dailyRate:100,vtDaily:10,
        workdayHours:8,startDate:"2026-01-01",
      }],
    },
  }];

  it("ignora o cache do blob e recalcula pelo arquivo",()=>{
    const result=rebuildArchivedLaborCosts({data,archiveRows:rows});
    expect(result.missing).toEqual([]);
    expect(result.rebuilt).toBe(1);
    expect(result.data.archivedLaborCosts["2026-07-Q1"])
      .not.toEqual(data.archivedLaborCosts["2026-07-Q1"]);
    expect(result.data.archivedLaborCosts["2026-07-Q1"]?.byDate?.["2026-07-10"]?.o1?.laborCost)
      .toBeGreaterThan(0);
  });

  it("informa arquivo ausente em vez de confiar no cache",()=>{
    const result=rebuildArchivedLaborCosts({data,archiveRows:[]});
    expect(result.missing).toEqual(["2026-07-Q1"]);
    expect(result.data.archivedLaborCosts).toEqual({});
  });

  it("sem quinzenas arquivadas zera qualquer cache residual",()=>{
    const result=rebuildArchivedLaborCosts({
      data:{archivedLaborCosts:{fantasma:{byDate:{}}}},
      archiveRows:rows,
    });
    expect(result).toMatchObject({missing:[],rebuilt:0,data:{archivedLaborCosts:{}}});
  });
});
