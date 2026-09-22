import { buildBudgetTree, flattenBudgetTree } from "./tree";

export const normalizeStructuralText = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const unitKey = unit => normalizeStructuralText(unit).trim().replace("²", "2").replace("³", "3");
export const compatibleMemoryUnit = (a, b) => !!unitKey(a) && unitKey(a) === unitKey(b);

export function structuralOrigin(scope) {
  const [floor, element] = scope.split("-");
  const floors = { fundacao: "Fundação", terreo: "Térreo", pavimento1: "1º pavimento", cobertura: "Cobertura", reservatorio: "Reservatório" };
  const elements = { pilares: "Pilares", vigas: "Vigas", laje: "Laje" };
  return { floor: floors[floor] || floor, element: floor === "fundacao" ? "Sapatas" : elements[element] || "Estrutura" };
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
