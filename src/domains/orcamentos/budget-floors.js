import { budgetSubtreeIds } from './tree';
import { budgetIsImmutable } from './calculations';
import { novaPilarPavimento, novaVigaPavimento, novaLajePavimento } from './memoria-calculo-estrutural';

export const DEFAULT_FLOORS = [
  { id:'terreo', nome:'TÉRREO', temLaje:false },
  { id:'pavimento1', nome:'1º PAVIMENTO', temLaje:true },
  { id:'cobertura', nome:'COBERTURA', temLaje:true },
  { id:'reservatorio', nome:'RESERVATÓRIO', temLaje:true },
];
export const memoryFloors = (memory = {}) => [...DEFAULT_FLOORS, ...(memory.pavimentosAdicionais || [])];

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
      ...(s.id === etapaId ? {nome:name,nivelM:elevation} : {})}))],
    itens:[...(budget.itens || []), ...sourceItems.map(i => ({...clone(i), id:itemMap.get(i.id), etapaId:stageMap.get(i.etapaId), quantidade:0}))],
    memoriaCalculo:{...memory, [id]:contents, pavimentosAdicionais:[...(memory.pavimentosAdicionais || []),floor], vinculosEstruturais:links},
  };
}
