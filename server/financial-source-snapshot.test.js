import {test,expect} from "vitest";
import {mergeFinancialSourceRows} from "./financial-source-snapshot.js";
import {encodeAppData} from "./data-codec.js";

test("projeção financeira usa configuração, equipamentos e ponto das linhas atuais sem alterar a origem",()=>{
  const core={pedidos:[{id:"real",pagamentos:[{id:"payment",valor:50}]}],config:{taxa:0},locacoesEquip:[],attendance:{employee:{"2026-10-01":{status:"F",_syncedAt:"2026-10-01T01:00:00Z"}}}};
  const before=structuredClone(core);
  const merged=mergeFinancialSourceRows(core,[
    {key:"arced_ponto_v1__config",value:encodeAppData({config:{taxa:10}})},
    {key:"arced_ponto_v1__equipamentos",value:{locacoesEquip:[{id:"rental",valor:100}]}},
    {key:"arced_ponto_v1__ponto__obra__work",value:{attendance:{employee:{"2026-10-01":{status:"P",_syncedAt:"2026-10-02T01:00:00Z"}}}}},
    {key:"arced_ponto_v1__arq__old",value:{config:{taxa:99},pedidos:[]}},
  ]);
  expect(merged.config).toEqual({taxa:10});
  expect(merged.locacoesEquip).toHaveLength(1);
  expect(merged.attendance.employee["2026-10-01"].status).toBe("P");
  expect(merged.pedidos).toEqual(core.pedidos);
  expect(core).toEqual(before);
});

test("projeção financeira recalcula a quinzena arquivada e ignora o resumo persistido",()=>{
  const core={
    config:{},
    quinzenasArquivadas:{"2026-07-Q1":{inicio:"2026-07-06",fim:"2026-07-20"}},
    archivedLaborCosts:{"2026-07-Q1":{byDate:{"2026-07-10":{o1:{laborCost:9999,benefitCost:9999}}}}},
  };
  const archive={
    meta:{quinzenaId:"2026-07-Q1"},
    attendance:{e1:{"2026-07-10":{status:"P",obraId:"o1"}}},
    employeesSnapshot:[{
      id:"e1",name:"Operário",obra:"o1",dailyRate:100,vtDaily:10,
      workdayHours:8,startDate:"2026-01-01",
    }],
    financialSnapshot:{byDate:{"2026-07-10":{o1:{laborCost:9999,benefitCost:9999}}}},
  };
  const merged=mergeFinancialSourceRows(core,[
    {key:"arced_ponto_v1__arq__2026-07-Q1",value:archive},
  ]);
  expect(merged.archivedLaborCosts["2026-07-Q1"].byDate["2026-07-10"].o1).toEqual({
    laborCost:100,benefitCost:10,
  });
});

test("projeção financeira falha fechado quando existe marcador sem arquivo imutável",()=>{
  expect(()=>mergeFinancialSourceRows({
    config:{},
    quinzenasArquivadas:{"2026-07-Q1":{inicio:"2026-07-06",fim:"2026-07-20"}},
    archivedLaborCosts:{"2026-07-Q1":{byDate:{}}},
  },[])).toThrow(/Arquivo de ponto ausente/);
});
