// Automatic alignment only. Ambiguous historical records require review;
// opening the screen must never merge or replace records by resemblance.
export function legacyPlanSyncIssue(data,obraId,plan,budget,source){
 if(!budget||!obraId)return '';
 const plans=(data.planos||[]).filter(item=>item.obraId===obraId);
 if(plans.length>1)return 'Sincronização automática pausada: há mais de um plano para esta obra. Confira os registros com o administrador antes de ajustar os vínculos.';
 const budgets=(data.orcamentos||[]).filter(item=>item.obraId===obraId);
 if(source==='rascunho'&&budgets.length>1)return 'Sincronização automática pausada: há mais de um orçamento sem vínculo confirmado. Confira a versão de origem do planejamento.';
 if(source!=='baseline'&&((plan.budgetId&&plan.budgetId!==budget.id)
  ||(plan.budgetVersionId&&plan.budgetVersionId!==(budget.versionId||budget.id)&&plan.budgetVersionId!==budget.id)))return 'Sincronização automática pausada: o vínculo antigo não corresponde ao orçamento exibido. Confira a origem antes de substituir a versão.';
 const stages=new Set();
 for(const task of plan.tarefas||[]){
  if(task.etapaId&&stages.has(task.etapaId))return 'Sincronização automática pausada: mais de uma tarefa usa a mesma etapa. As tarefas foram preservadas para conferência.';
  if(task.etapaId)stages.add(task.etapaId);
 }
 return '';
}
