import {normalizeArchivedCosts,summarizeArchivedCosts} from "./archived-costs.js";
import {decodeAppData} from "./data-codec.js";

export const archivedLaborKeys=(data,key="arced_ponto_v1")=>
  Object.keys(data?.quinzenasArquivadas||{})
    .sort()
    .map(quinzenaId=>({quinzenaId,key:`${key}__arq__${quinzenaId}`}));

export const rebuildArchivedLaborCosts=({
  data={},
  archiveRows=[],
  key="arced_ponto_v1",
}={})=>{
  const expected=archivedLaborKeys(data,key);
  if(!expected.length)return {
    data:{...data,archivedLaborCosts:{}},
    missing:[],
    rebuilt:0,
  };

  const byKey=new Map((archiveRows||[]).map(row=>[String(row?.key||""),row]));
  const archivedLaborCosts={};
  const missing=[];

  for(const item of expected){
    const row=byKey.get(item.key);
    if(!row){
      missing.push(item.quinzenaId);
      continue;
    }
    archivedLaborCosts[item.quinzenaId]=normalizeArchivedCosts(
      summarizeArchivedCosts(decodeAppData(row.value),data?.config,data?.employees),
    );
  }

  return {
    data:{...data,archivedLaborCosts},
    missing,
    rebuilt:Object.keys(archivedLaborCosts).length,
  };
};
