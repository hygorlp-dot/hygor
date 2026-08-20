import { WORKER_ELIGIBILITY } from "./constants.js";
export const overdue=(date,asOf)=>!!date&&String(date)<String(asOf);
export const evaluateWorkerEligibility=(worker={},requirements={},asOf="")=>{
  if(worker.active===false||worker.blocked===true)return {status:WORKER_ELIGIBILITY.BLOCKED,reasons:["Trabalhador bloqueado ou inativo."]};
  const reasons=[];if((requirements.requiredDocuments||[]).some(key=>!worker.documents?.[key]))reasons.push("Documentação obrigatória pendente.");
  if((requirements.requiredTrainings||[]).some(key=>overdue(worker.trainings?.[key]?.expiresAt||worker.trainings?.[key],asOf)))reasons.push("Treinamento vencido.");
  if(overdue(worker.examExpiresAt,asOf))reasons.push("Exame ocupacional vencido.");
  if(requirements.criticalActivity&&worker.restrictions?.length)reasons.push("Atividade crítica incompatível com restrição cadastrada.");
  const status=reasons.some(item=>item.includes("Documentação"))?WORKER_ELIGIBILITY.DOCUMENTATION_PENDING:reasons.some(item=>item.includes("Treinamento"))?WORKER_ELIGIBILITY.TRAINING_EXPIRED:reasons.some(item=>item.includes("Exame"))?WORKER_ELIGIBILITY.EXAM_EXPIRED:reasons.length?WORKER_ELIGIBILITY.RESTRICTED:WORKER_ELIGIBILITY.FIT;
  return {status,reasons,eligible:status===WORKER_ELIGIBILITY.FIT||status===WORKER_ELIGIBILITY.RESTRICTED&&!requirements.criticalActivity};
};
export const validateActivitySafety=({activity={},workers=[],aprs=[],permits=[],asOf=""}={})=>{const critical=!!activity.criticalActivity;const blocked=workers.map(worker=>({worker,eligibility:evaluateWorkerEligibility(worker,{criticalActivity:critical,requiredDocuments:activity.requiredDocuments||[],requiredTrainings:activity.requiredTrainings||[]},asOf)})).filter(item=>!item.eligibility.eligible);if(blocked.length)return {ok:false,reason:"Há trabalhador não elegível.",blocked};if(critical&&!aprs.some(item=>item.activityId===activity.id&&item.status==="aprovada"))return {ok:false,reason:"Atividade crítica exige APR aprovada."};if(critical&&!permits.some(item=>item.activityId===activity.id&&item.status==="liberada"))return {ok:false,reason:"Atividade crítica exige permissão de trabalho liberada."};return {ok:true,blocked:[]};};
