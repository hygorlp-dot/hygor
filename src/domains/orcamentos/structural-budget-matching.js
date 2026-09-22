import { buildBudgetTree, flattenBudgetTree } from "./tree";

export const normalizeStructuralText = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const unitKey = unit => normalizeStructuralText(unit).trim().replace("²", "2").replace("³", "3");
export const compatibleMemoryUnit = (a, b) => !!unitKey(a) && unitKey(a) === unitKey(b);

export function structuralOrigin(scope, memory = {}) {
  const [floor, element] = scope.split("-");
  const floors = { fundacao: "Fundação", terreo: "Térreo", pavimento1: "1º pavimento", cobertura: "Cobertura", reservatorio: "Reservatório" };
  const elements = { pilares: "Pilares", vigas: "Vigas", laje: "Laje", alvenaria: "Alvenaria" };
  const custom = memory.pavimentosAdicionais?.find(p => p.id === floor);
  return { floor: custom?.nome || floors[floor] || floor, element: floor === "fundacao" ? "Sapatas" : elements[element] || "Estrutura" };
}

export function memoryBudgetItems(budget) {
  const stages = budget?.etapas || [];
  const path = id => {
    const names = [], seen = new Set();
    while (id && !seen.has(id)) {
      seen.add(id);
      const stage = stages.find(value => value.id === id);
      if (!stage) break;
      names.unshift(stage.nome);
      id = stage.parentId;
    }
    return names.join(" › ");
  };
  return flattenBudgetTree(buildBudgetTree(stages, budget?.itens))
    .filter(item => item.tipo !== "etapa" && item.tipo !== "titulo")
    .map(item => ({ ...item, stagePath: path(item.etapaId) }));
}

// Classifica o serviço principal, sem confundir materiais citados na descrição
// (ex.: concretagem em sistema de fôrmas ou escavação para colocação de fôrmas).
export function structuralService(description) {
  const text = normalizeStructuralText(description);
  if (/^\s*(?:(?:execucao|assentamento) de )?alvenaria\b/.test(text)) return "alvenaria";
  if (/\breaterro\b/.test(text)) return "reaterro";
  if (/\bescavacao\b/.test(text)) return "escavacao";
  if (/^\s*escoramento\b/.test(text)) return "escoramento";
  if (/concreto magro|lastro.*concreto|concreto.*lastro/.test(text)) return "magro";
  if (/^(forma|formas|forma[s]? de)\b|(?:montagem|desmontagem|fabricacao|execucao|confeccao).*\bformas?\b/.test(text) && !/^concretagem\b/.test(text)) return "forma";
  if (/\bescoramento\b/.test(text)) return "escoramento";
  if (/\barmacao\b|\barmadura\b|tela soldada|\baco\b/.test(text)) return "aco";
  if (/\bconcretagem\b|\bconcreto\b/.test(text)) return "concreto";
  if (/\blaje\b/.test(text)) return "laje";
  return "outro";
}

export function memoryService(row) {
  if (row.key.startsWith("aco-")) return "aco";
  if (row.key.startsWith("area-")) return "laje";
  return row.key;
}

export function compatibleStructuralItem(row, item) {
  return compatibleMemoryUnit(row.unit, item.unidade) && memoryService(row) === structuralService(item.descricao);
}

// Sugestão exige pavimento e elemento no caminho da etapa. A descrição pode
// citar outros elementos, portanto não basta para uma escolha automática.
export function suggestedStructuralTarget(scope, row, budget, candidates) {
  const origin=structuralOrigin(scope,budget?.memoriaCalculo);
  const norm=value=>normalizeStructuralText(value).replace(/[º°ª]/g,'').replace(/\s+/g,' ').trim();
  const floor=norm(origin.floor), element=norm(origin.element);
  const steelMatches=item=>{
    if(!row.key.startsWith('aco-'))return true;
    if(row.key==='aco-vigota')return /tela soldada/.test(norm(item.descricao));
    const diameter=Number(row.key.slice(4));
    return Number.isFinite(diameter) && [...norm(item.descricao).matchAll(/(\d+(?:[.,]\d+)?)\s*mm\b/g)]
      .some(match=>Number(match[1].replace(',','.'))===diameter);
  };
  const matches=candidates.filter(item=>compatibleStructuralItem(row,item)
    && steelMatches(item) && norm(item.stagePath).includes(floor) && norm(item.stagePath).includes(element));
  return matches.length===1 ? matches[0] : null;
}
