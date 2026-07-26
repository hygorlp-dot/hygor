const number = value => Number(value ?? 0);
const moneyOf = item => Number.isFinite(number(item?.total)) && number(item?.total) > 0 ? number(item.total) : number(item?.totalCentavos) / 100;
const linksOf = activity => Array.isArray(activity?.budgetLinks) ? activity.budgetLinks : (Array.isArray(activity?.orcamentoItens) ? activity.orcamentoItens : []);

/**
 * Checks read-only links from schedule activities to budget items. This is a
 * guard before any future persistence command: it neither allocates values nor
 * changes the budget, so a planning pilot cannot silently alter the baseline.
 */
export function validateActivityBudgetLinks({ activities = [], budgetItems = [] } = {}) {
  const issues=[]; const itemById=new Map(budgetItems.map(item => [String(item.id), item])); const usage=new Map(); const projections=[];
  activities.forEach(activity => linksOf(activity).forEach((raw, index) => {
    const activityId=String(activity?.id || ""); const budgetItemId=String(raw?.budgetItemId || raw?.itemId || raw?.id || "");
    if (!activityId || !budgetItemId) { issues.push({ severity:"error", code:"invalid_budget_link", activityId, budgetItemId, message:"Vínculo atividade-orçamento exige os dois identificadores." }); return; }
    const item=itemById.get(budgetItemId);
    if (budgetItems.length && !item) { issues.push({ severity:"error", code:"budget_item_not_found", activityId, budgetItemId, message:"Item orçamentário vinculado não existe na versão selecionada." }); return; }
    const allocationPercentage=number(raw.allocationPercentage ?? raw.rateio);
    if (!(allocationPercentage > 0 && allocationPercentage <= 100)) { issues.push({ severity:"error", code:"invalid_allocation", activityId, budgetItemId, message:"Rateio do item orçamentário deve estar entre 0 e 100%." }); return; }
    const allocatedValue=raw.allocatedValue == null ? moneyOf(item) * allocationPercentage / 100 : number(raw.allocatedValue);
    if (!(allocatedValue >= 0)) { issues.push({ severity:"error", code:"invalid_allocated_value", activityId, budgetItemId, message:"Valor alocado não pode ser negativo." }); return; }
    const value=moneyOf(item); const row={ activityId, budgetItemId, allocationPercentage, allocatedValue, budgetValue:value, sourceIndex:index };
    projections.push(row); usage.set(budgetItemId,[...(usage.get(budgetItemId) || []), row]);
  }));
  const summaries=[...usage.entries()].map(([budgetItemId, rows]) => {
    const allocationPercentage=rows.reduce((sum,row) => sum+row.allocationPercentage,0); const allocatedValue=rows.reduce((sum,row) => sum+row.allocatedValue,0); const budgetValue=rows[0]?.budgetValue || 0;
    if (allocationPercentage > 100.0001) issues.push({ severity:"error", code:"overallocation_percentage", budgetItemId, allocationPercentage, message:"Rateio de um item orçamentário não pode ultrapassar 100%." });
    if (budgetValue > 0 && allocatedValue > budgetValue + 0.005) issues.push({ severity:"error", code:"overallocation_value", budgetItemId, allocatedValue, budgetValue, message:"Valor alocado ultrapassa o valor do item orçamentário." });
    return { budgetItemId, allocationPercentage, allocatedValue, budgetValue, remainingPercentage:Math.max(0,100-allocationPercentage), remainingValue:Math.max(0,budgetValue-allocatedValue) };
  });
  return { ok:!issues.some(issue => issue.severity === "error"), links:projections, budgetUsage:summaries, issues };
}
