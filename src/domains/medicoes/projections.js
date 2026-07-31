import { projectTechnicalMeasurementProgress } from "./calculations.js";

/** Reconstituí o espelho do plano somente a partir dos boletins aprovados. */
export const rebuildTechnicalMeasurementProjection=(data={},obraId,now="")=>{
  const progress=projectTechnicalMeasurementProgress(data.medicoesObra||[],obraId);
  const byTask=new Map(progress.map(item=>[item.tarefaId,item]));
  const planos=(data.planos||[]).map(plan=>{
    if(plan.obraId!==obraId)return plan;
    return {...plan,tarefas:(plan.tarefas||[]).map(task=>{
      const confirmed=byTask.get(task.id);
      if(confirmed)return {...task,progresso:confirmed.progresso,progressoAtualizadoEm:now||task.progressoAtualizadoEm||"",progressoOrigem:"medicao_tecnica_aprovada",medicaoTecnicaId:confirmed.medicaoId};
      // Se o último fato técnico foi cancelado, não é permitido manter no
      // plano o percentual que ele havia projetado. O RDO continua evidência,
      // mas não volta a ser fonte oficial do avanço.
      if(task.progressoOrigem==="medicao_tecnica_aprovada")return {...task,progresso:0,progressoAtualizadoEm:now||task.progressoAtualizadoEm||"",progressoOrigem:"sem_medicao_tecnica",medicaoTecnicaId:""};
      return task;
    })};
  });
  return {...data,planos,technicalMeasurementProgress:{...(data.technicalMeasurementProgress||{}),[obraId]:{generatedAt:now,items:progress}}};
};
