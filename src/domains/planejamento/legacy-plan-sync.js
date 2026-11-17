// Ambiguous historical links must be reviewed before aligning a plan.
export function legacyPlanSyncIssue(data,obraId,plan,budget,source){
 if(!budget||!obraId)return '';
 const plans=(data.planos||[]).filter(item=>item.obraId===obraId);
 if(plans.length>1)return 'Vínculos do cronograma exigem conferência: há mais de um plano para esta obra. Confira os registros com o administrador antes de ajustar os vínculos.';
 const budgets=(data.orcamentos||[]).filter(item=>item.obraId===obraId);
 if(source==='rascunho'&&budgets.length>1)return 'Vínculos do cronograma exigem conferência: há mais de um orçamento sem vínculo confirmado. Confira a versão de origem do planejamento.';
 if(source!=='baseline'&&((plan.budgetId&&plan.budgetId!==budget.id)
  ||(plan.budgetVersionId&&plan.budgetVersionId!==(budget.versionId||budget.id)&&plan.budgetVersionId!==budget.id)))return 'Vínculos do cronograma exigem conferência: o vínculo antigo não corresponde ao orçamento exibido. Confira a origem antes de substituir a versão.';
 const stages=new Set();
 for(const task of plan.tarefas||[]){
  if(task.etapaId&&stages.has(task.etapaId))return 'Vínculos do cronograma exigem conferência: mais de uma tarefa usa a mesma etapa. As tarefas foram preservadas para conferência.';
  if(task.etapaId)stages.add(task.etapaId);
 }
 return '';
}
