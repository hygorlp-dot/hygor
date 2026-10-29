import {describe,expect,it} from "vitest";
import {rebuildArchivedLaborCosts} from "./financial-archived-costs-source.js";
import {encodeAppData} from "./data-codec.js";
import {archivedCltScenario} from "../src/fixtures/archived-clt.js";

describe("FIN 9.6 — custos arquivados vêm dos arquivos imutáveis",()=>{
  const data={
    config:{laborCharges:{diaristaPercent:10}},
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
    expect(result.data.archivedLaborCosts["2026-07-Q1"]?.byDate?.["2026-07-10"]?.o1)
      .toMatchObject({laborCost:110,benefitCost:10});
  });

  it("recalcula o mesmo arquivo quando a configuração de encargos muda",()=>{
    const semEncargo=rebuildArchivedLaborCosts({
      data:{...data,config:{laborCharges:{diaristaPercent:0}}},
      archiveRows:rows,
    });
    const comEncargo=rebuildArchivedLaborCosts({
      data:{...data,config:{laborCharges:{diaristaPercent:20}}},
      archiveRows:rows,
    });
    expect(semEncargo.data.archivedLaborCosts["2026-07-Q1"].byDate["2026-07-10"].o1.laborCost).toBe(100);
    expect(comEncargo.data.archivedLaborCosts["2026-07-Q1"].byDate["2026-07-10"].o1.laborCost).toBe(120);
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

  it("completa modalidade CLT antiga sem transformar o salário em diária nem mudar benefícios históricos",()=>{
    const {data,archiveRows}=archivedCltScenario();
    data.employees[0].vtDaily=90;
    const result=rebuildArchivedLaborCosts({data,archiveRows});
    const archive=result.data.archivedLaborCosts["2026-07-Q1"];
    expect(archive.byDate["2026-07-10"].o2).toEqual({laborCost:0,benefitCost:25});
    expect(archive.cltAllocationByDate["2026-07-10"]["clt-1"]).toEqual({obraId:"o2",status:"P"});
  });

  it("recompõe igualmente arquivo JSON e arquivo compactado",()=>{
    const {data,archiveRows}=archivedCltScenario();
    const value=encodeAppData({...archiveRows[0].value,notes:"x".repeat(70000)});
    expect(value.__arcdEncoding).toBe("arcd-gzip-base64-v1");
    expect(rebuildArchivedLaborCosts({data,archiveRows:[{...archiveRows[0],value}]}))
      .toEqual(rebuildArchivedLaborCosts({data,archiveRows}));
  });
});
