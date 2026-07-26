import { projectTechnicalMeasurementProgress } from "./calculations.js";

/** Reconstituí o espelho do plano somente a partir dos boletins aprovados. */
export const rebuildTechnicalMeasurementProjection=(data={},obraId,now="")=>{
  const progress=projectTechnicalMeasurementProgress(data.medicoesObra||[],obraId);
  const byTask=new Map(progress.map(item=>[item.tarefaId,item]));
  const planos=(data.planos||[]).map(plan=>{
    if(plan.obraId!==obraId)return plan;
    return {...plan,tarefas:(plan.tarefas||[]).map(task=>{
      const confirmed=byTask.get(task.id);
      return confirmed?{...task,progresso:confirmed.progresso,progressoAtualizadoEm:now||task.progressoAtualizadoEm||"",progressoOrigem:"medicao_tecnica_aprovada",medicaoTecnicaId:confirmed.medicaoId}:task;
    })};
  });
  return {...data,planos,technicalMeasurementProgress:{...(data.technicalMeasurementProgress||{}),[obraId]:{generatedAt:now,items:progress}}};
};
