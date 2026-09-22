import { memoryFloors, DEFAULT_FLOORS } from './budget-floors';

export function structuralImportTargets(memory={}){
  const floors=memoryFloors(memory), result=Object.fromEntries(DEFAULT_FLOORS.map(f=>[f.id,f.id]));
  for(const floor of floors)if(floor.pavimentoProjeto)result[floor.pavimentoProjeto]=floor.id;
  for(const [source,target] of Object.entries(memory.destinosImportacao || {}))if(floors.some(f=>f.id===target))result[source]=target;
  return result;
}
export function validateImportTargets(memory,targets){
  const ids=new Set(memoryFloors(memory).map(f=>f.id));
  if(Object.values(targets).some(id=>!ids.has(id)))throw new Error('Um pavimento de destino foi removido. Selecione novamente.');
  if(new Set(Object.values(targets)).size!==Object.values(targets).length)throw new Error('Cada pavimento do projeto deve ter um destino diferente.');
  return targets;
}
export function remapImportSources(sources={},targets={}){
  return Object.fromEntries(Object.entries(sources).map(([key,value])=>{
    const floor=key.split('-')[0];
    return [targets[floor]?targets[floor]+key.slice(floor.length):key,value];
  }));
}
export function mergeImportSummaries(previous={},incoming={},targets={}){
  const result={...previous};
  for(const [source,summary] of Object.entries(incoming))result[targets[source] || source]=summary;
  return result;
}
