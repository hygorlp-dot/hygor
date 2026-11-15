export const MAX_BUDGET_LEVELS=6;

// IDs e parentId são a origem da hierarquia. Nome, código visual e posição
// não identificam parentes; uma origem ambígua exige conferência.
export function budgetHierarchyError(budget){
 const stages=budget?.etapas||[],items=budget?.itens||[],byId=new Map();
 if(!Array.isArray(stages)||!Array.isArray(items))return 'Etapas e itens devem ser listas.';
 for(const stage of stages){
  if(!stage?.id||byId.has(stage.id))return 'Etapa sem ID ou com ID duplicado: confira a origem.';
  byId.set(stage.id,stage);
 }
 for(const stage of stages){
  const seen=new Set();let current=stage,depth=0;
  while(current){
   if(seen.has(current.id))return 'Há ciclo entre etapas. Confira a etapa superior.';
   seen.add(current.id);depth++;
   if(depth>MAX_BUDGET_LEVELS)return `O orçamento admite até ${MAX_BUDGET_LEVELS} níveis de etapas.`;
   if(!current.parentId)break;
   current=byId.get(current.parentId);
   if(!current)return 'Etapa superior não encontrada: confira a origem.';
  }
 }
 const itemIds=new Set();
 for(const item of items){
  if(!item?.id||itemIds.has(item.id))return 'Item sem ID ou com ID duplicado: confira a origem.';
  itemIds.add(item.id);
  if(!byId.has(item.etapaId))return 'Item sem etapa válida: confira a origem.';
 }
 return '';
}

export function assertBudgetHierarchy(budget){
 const error=budgetHierarchyError(budget);if(error)throw Error(error);
 return budget;
}
