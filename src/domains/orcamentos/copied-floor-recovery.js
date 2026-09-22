import { DEFAULT_FLOORS } from './budget-floors';
import { budgetIsImmutable } from './calculations';
import { structuralBudgetRows } from './structural-budget-apply';

const nameKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\b(?:supraestrutura|superestrutura|estrutura)\b/g,'').replace(/[()º°ª]/g,'').replace(/\s+/g,' ').trim();
const hasMeasures = floor => ['pilar','viga','laje','alvenaria'].some(kind=>Object.entries(floor?.[kind] || {}).some(([key,value])=>{
  if(key==='acoPorBitola')return (value || []).some(row=>Number(row.kg)>0);
  // Configurações de malha, largura e espessura não são quantitativos extraídos.
  return /^(concretoM3|formaM2|volumeM3|volumeVigotasM3|volumeMacicasM3|areaM2|areaVigotaM2|areaMacicaM2|areaPlantaVigasM2|acoTotalProjetoKg)$/.test(key) && Number(value)>0;
}));

export function copiedFloorRecoveries(budget){
  const memory=budget?.memoriaCalculo || {},custom=memory.pavimentosAdicionais || [];
  return custom.flatMap(floor=>{
    const canonical=DEFAULT_FLOORS.find(f=>nameKey(f.nome)===nameKey(floor.nome));
    if(!canonical || custom.filter(f=>nameKey(f.nome)===nameKey(floor.nome)).length!==1)return [];
    if(!hasMeasures(memory[canonical.id]) || hasMeasures(memory[floor.id]) || memory.resumosProjeto?.[floor.id])return [];
    if(Object.keys(memory.origensEstruturais || {}).some(key=>key.startsWith(`${floor.id}-`)))return [];
    if(memory.cadastroPavimentos?.[canonical.id]?.etapaId && memory.cadastroPavimentos[canonical.id].etapaId!==floor.etapaId)return [];
    const links=memory.vinculosEstruturais || {};
    const copied=Object.entries(links).filter(([key,target])=>key.startsWith(`${floor.id}-`) && target);
    if(!copied.length || copied.some(([key,target])=>links[canonical.id+key.slice(floor.id.length)] && links[canonical.id+key.slice(floor.id.length)]!==target))return [];
    return [{source:canonical.id,target:floor.id,name:canonical.nome,stageId:floor.etapaId,count:copied.length}];
  });
}

export function recoverCopiedFloor(budget,target){
  if(budgetIsImmutable(budget))throw new Error('Crie uma revisão do orçamento aprovado.');
  const recovery=copiedFloorRecoveries(budget).find(r=>r.target===target);
  if(!recovery)throw new Error('Os dados mudaram ou os pavimentos têm medidas próprias. Preserve-os e ajuste os vínculos individualmente.');
  const {source}=recovery, memory=budget.memoriaCalculo;
  const floor=memory.pavimentosAdicionais.find(f=>f.id===target);
  const available=new Set(Object.entries(structuralBudgetRows(budget)).flatMap(([scope,rows])=>rows.map(row=>`${scope}.${row.key}`)));
  const remap=record=>Object.fromEntries(Object.entries(record || {}).flatMap(([key,value])=>{
    if(!key.startsWith(`${target}-`))return [[key,value]];
    const mapped=source+key.slice(target.length);
    // A cópia pode ter bitolas que não existem neste pavimento do projeto.
    return available.has(mapped)?[[mapped,value]]:[];
  }));
  const next={...memory,vinculosEstruturais:remap(memory.vinculosEstruturais),aplicacoesEstruturais:remap(memory.aplicacoesEstruturais),
    pavimentosAdicionais:memory.pavimentosAdicionais.filter(f=>f.id!==target),
    cadastroPavimentos:{...memory.cadastroPavimentos,[source]:{...DEFAULT_FLOORS.find(f=>f.id===source),nivelM:floor.nivelM,etapaId:floor.etapaId}},
    destinosImportacao:Object.fromEntries(Object.entries({...memory.destinosImportacao,[source]:source}).map(([key,value])=>[key,value===target?source:value])),
  };
  delete next[target];delete next.cadastroPavimentos[target];
  return {...budget,memoriaCalculo:next,etapas:budget.etapas.map(s=>s.id===floor.etapaId?{...s,pavimentoId:source,nivelM:floor.nivelM}:s)};
}
