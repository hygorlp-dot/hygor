// @ts-check

/**
 * @template {{id: string, obraId?: string}} Budget
 * @typedef {{id: string, itens: Budget[], titulo?: string, vazio?: string}} BudgetGroup
 */

/**
 * @template {{id: string, obraId?: string}} Budget
 * @param {Budget[]} budgets
 * @param {{id: string, name: string}[]} works
 * @param {{fixedWorkId: string, focusedWorkId?: string | null, selectedBudgetId?: string | null}} context
 */
export function selectBudgetWorkContext(budgets, works, {fixedWorkId, focusedWorkId, selectedBudgetId}) {
  const orcamentos = fixedWorkId ? budgets.filter(budget => budget.obraId === fixedWorkId) : budgets;
  const orc = orcamentos.find(budget => budget.id === selectedBudgetId);
  const obraEmFoco = fixedWorkId ? null : works.find(work => work.id === focusedWorkId);
  /** @type {BudgetGroup<Budget>[]} */
  let gruposOrcamento = [];
  if (orcamentos.length && !obraEmFoco) {
    gruposOrcamento = [{id: "todos", itens: orcamentos}];
  }
  if (orcamentos.length && obraEmFoco) {
    // Orçamentos comerciais sem obra permanecem na lista, depois do grupo em foco.
    gruposOrcamento = [
      {id: "foco", titulo: `Obra em foco · ${obraEmFoco.name}`, itens: orcamentos.filter(budget => budget.obraId === obraEmFoco.id), vazio: "Nenhum orçamento vinculado a esta obra."},
      {id: "outros", titulo: "Outros orçamentos", itens: orcamentos.filter(budget => budget.obraId !== obraEmFoco.id)},
    ].filter(group => group.itens.length || group.vazio);
  }
  return {orcamentos, gruposOrcamento, orc};
}
