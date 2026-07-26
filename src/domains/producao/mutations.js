import { applyProgressToCommitment } from "./calculations.js";

const event=(type,actor={},now="",reason="")=>({type,at:now,byId:actor.id||"",by:actor.nome||actor.name||"",reason});

export const validateProgressRecord=(record={})=>{
  const errors=[];
  if(!String(record.id||"").trim()||!String(record.obraId||"").trim()||!String(record.activityId||"").trim())errors.push("Avanço físico exige identificação, obra e atividade.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(record.data||"")))errors.push("Avanço físico exige uma data válida.");
  if(!Number.isFinite(Number(record.quantity))||Number(record.quantity)<=0)errors.push("Avanço físico exige quantidade maior que zero.");
  return {ok:!errors.length,errors};
};

export const createProgressRecord=(input={}, {actor={},now=""}={})=>{
  const record={...input,status:"confirmado",version:1,createdAt:input.createdAt||now,createdById:actor.id||"",history:[...(input.history||[]),event("created",actor,now)]};
  const validation=validateProgressRecord(record);
  return validation.ok?{ok:true,record}:{ok:false,error:validation.errors.join(" ")};
};

export const cancelProgressRecord=(record={}, {reason="",actor={},now=""}={})=>{
  if(record.status==="cancelado")return {ok:false,error:"Avanço físico já está cancelado."};
  if(!String(reason).trim())return {ok:false,error:"Estorno do avanço físico exige motivo."};
  return {ok:true,record:{...record,status:"cancelado",motivoCancelamento:String(reason).trim(),cancelledAt:now,cancelledById:actor.id||"",version:Number(record.version||0)+1,history:[...(record.history||[]),event("cancelled",actor,now,String(reason).trim())]}};
};
export const completeWeeklyCommitment=(commitment,progress,{actor={},now="",reason=""}={})=>{const next=applyProgressToCommitment(commitment,progress);if(!next.eligibleForCompletion&&!String(reason).trim())return {ok:false,error:"Produção insuficiente exige motivo de não cumprimento."};return {ok:true,commitment:{...next,status:next.eligibleForCompletion?"concluido":"nao_concluido",motivoNaoCumprimento:next.eligibleForCompletion?"":String(reason),updatedAt:now,updatedById:actor.id||""}};};
