import { blankItemMemory } from './item-memory-models';
import { budgetSubtreeIds } from './tree';
import { budgetIsImmutable } from './calculations';
import { novaPilarPavimento, novaVigaPavimento, novaLajePavimento } from './memoria-calculo-estrutural';

export const DEFAULT_FLOORS = [
  { id:'terreo', nome:'TÉRREO', temLaje:false },
  { id:'pavimento1', nome:'1º PAVIMENTO', temLaje:true },
  { id:'cobertura', nome:'COBERTURA', temLaje:true },
  { id:'reservatorio', nome:'RESERVATÓRIO', temLaje:true },
];
export const memoryFloors = (memory = {}) => [...DEFAULT_FLOORS, ...(memory.pavimentosAdicionais || [])]
  .map(f=>({...f,...memory.cadastroPavimentos?.[f.id],id:f.id}));

export function updateBudgetFloor(budget,id,patch){
  if(budgetIsImmutable(budget))throw new Error('Crie uma revisão do orçamento aprovado.');
  const memory=budget.memoriaCalculo || {}, floors=memoryFloors(memory);
  if(!floors.some(f=>f.id===id))throw new Error('Pavimento não encontrado.');
  const nome=String(patch.nome || '').trim(), nivelM=Number(String(patch.nivelM).replace(',','.'));
  if(!nome || String(patch.nivelM ?? '').trim()==='' || !Number.isFinite(nivelM))throw new Error('Informe nome e nível em metros.');
  if(floors.some(f=>f.id!==id&&f.nome.toLocaleLowerCase()===nome.toLocaleLowerCase()))throw new Error('Nome de pavimento já utilizado.');
  if(patch.etapaId && !(budget.etapas || []).some(s=>s.id===patch.etapaId))throw new Error('Etapa não encontrada.');
  if(patch.etapaId && floors.some(f=>f.id!==id&&f.etapaId===patch.etapaId))throw new Error('Esta etapa já pertence a outro pavimento.');
  const record={...floors.find(f=>f.id===id),...patch,nome,nivelM,id};
  return {...budget,memoriaCalculo:{...memory,cadastroPavimentos:{...memory.cadastroPavimentos,[id]:record}},
    etapas:(budget.etapas || []).map(stage=>stage.id===record.etapaId?{...stage,nome,nivelM,pavimentoId:id}:
      stage.pavimentoId===id?{...stage,pavimentoId:undefined}:stage)};
}

export function reconcileBudgetFloors(budget){
  const memory=budget.memoriaCalculo || {}, registry={...memory.cadastroPavimentos};
  const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036fºª°]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const stageFloors=new Map();
  for(const floor of memoryFloors(memory)){
    let stage=(budget.etapas || []).find(s=>s.pavimentoId===floor.id || s.id===floor.etapaId);
    if(!stage && !floor.etapaId && !memory.cadastroPavimentos?.[floor.id]){
      const candidates=(budget.etapas || []).filter(s=>!s.pavimentoId && (normalize(s.nome)===normalize(floor.nome) || normalize(s.nome).endsWith(` ${normalize(floor.nome)}`)));
      if(candidates.length===1 && !stageFloors.has(candidates[0].id))stage=candidates[0];
    }
    if(stage){registry[floor.id]={...floor,nome:stage.nome,nivelM:stage.nivelM ?? floor.nivelM,etapaId:stage.id};stageFloors.set(stage.id,floor.id);}
  }
  return {...budget,etapas:(budget.etapas || []).map(s=>stageFloors.has(s.id)?{...s,pavimentoId:stageFloors.get(s.id)}:s),memoriaCalculo:{...memory,cadastroPavimentos:registry}};
}

export function addBudgetFloor(budget, { nome, nivel, origem, etapaId }, gerarId) {
  if (budgetIsImmutable(budget)) throw new Error('Crie uma revisão do orçamento aprovado.');
  const name = String(nome || '').trim();
  const elevation = Number(String(nivel).replace(',', '.'));
  if (!name || String(nivel ?? '').trim() === '' || !Number.isFinite(elevation)) throw new Error('Informe o nome e o nível em metros.');
  if (!['terreo','pavimento1'].includes(origem)) throw new Error('Escolha térreo ou 1º pavimento como modelo.');
  const memory = budget.memoriaCalculo || {};
  if (memoryFloors(memory).some(f => f.nome.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('Já existe um pavimento com este nome.');
  const sourceStage = (budget.etapas || []).find(s => s.id === etapaId);
  if (!sourceStage) throw new Error('Selecione a etapa do orçamento que deseja copiar.');
  const stageIds = new Set(budgetSubtreeIds(budget.etapas, etapaId));
  const stages = budget.etapas.filter(s => stageIds.has(s.id));
  const stageMap = new Map(stages.map(s => [s.id, gerarId()]));
  const sourceItems = (budget.itens || []).filter(i => stageIds.has(i.etapaId));
  const itemMap = new Map(sourceItems.map(i => [i.id, gerarId()]));
  const id = `pav_${String(gerarId()).replace(/[^a-zA-Z0-9_]/g, '')}`;
  const clone = value => JSON.parse(JSON.stringify(value));
  const floor = { id, nome:name, nivelM:elevation, origem, etapaId:stageMap.get(etapaId), temLaje:true };
  const source = memory[origem] || {};
  const steel = kind => (source[kind]?.acoPorBitola || []).map(a => ({ bitola:a.bitola, kg:0 }));
  const contents = {
    pilar:novaPilarPavimento({acoPorBitola:steel('pilar')}),
    viga:novaVigaPavimento({acoPorBitola:steel('viga')}),
    laje:novaLajePavimento({acoPorBitola:steel('laje'),
      ...(source.laje?.malhaVigota ? {malhaVigota:source.laje.malhaVigota, pesoMalhaVigotaKgM2:source.laje.pesoMalhaVigotaKgM2} : {})}),
    alvenaria:{areaM2:0},
  };
  const links = { ...memory.vinculosEstruturais };
  for (const [key, target] of Object.entries(memory.vinculosEstruturais || {})) {
    if (key.startsWith(`${origem}-`) && itemMap.has(target)) links[id + key.slice(origem.length)] = itemMap.get(target);
  }
  return {
    ...budget,
    etapas:[...budget.etapas, ...stages.map(s => ({...clone(s), id:stageMap.get(s.id),
      parentId:s.id === etapaId ? (s.parentId || '') : stageMap.get(s.parentId),
      ...(s.id === etapaId ? {nome:name,nivelM:elevation,pavimentoId:id} : {pavimentoId:undefined})}))],
    itens:[...(budget.itens || []), ...sourceItems.map(i => ({...clone(i), id:itemMap.get(i.id), etapaId:stageMap.get(i.etapaId), quantidade:0, ...(i.memorialMedicao ? {memorialMedicao:blankItemMemory(i.memorialMedicao)} : {})}))],
    memoriaCalculo:{...memory, [id]:contents, pavimentosAdicionais:[...(memory.pavimentosAdicionais || []),floor], vinculosEstruturais:links},
  };
}
