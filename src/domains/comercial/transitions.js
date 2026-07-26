import { OPPORTUNITY_STAGES, STAGE_PROBABILITY, TERMINAL_OPPORTUNITY_STAGES } from "./constants.js";
const order=Object.fromEntries([...OPPORTUNITY_STAGES,...TERMINAL_OPPORTUNITY_STAGES].map((stage,index)=>[stage,index]));
export const transitionOpportunity=(commercial,{opportunityId,targetStage,actor,reason="",eventType="manual",eventId="",metadata={}})=>{
  const current=(commercial?.opportunities||[]).find(item=>item.id===opportunityId);
  if(!current)return {ok:false,reason:"Oportunidade não encontrada."};
  if(![...OPPORTUNITY_STAGES,...TERMINAL_OPPORTUNITY_STAGES].includes(targetStage))return {ok:false,reason:"Etapa de destino inválida."};
  const backwards=order[targetStage]<order[current.stage];
  if(backwards&&!String(reason).trim())return {ok:false,reason:"O retrocesso exige justificativa."};
  if(targetStage==="perdido"&&!String(reason).trim())return {ok:false,reason:"A perda exige motivo."};
  const now=new Date().toISOString();const event={id:`stage_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,opportunityId,etapaAnterior:current.stage,etapaNova:targetStage,entrouEm:now,saiuEm:now,autorId:actor?.id||"",autorNome:actor?.nome||actor?.email||"Sistema",motivo:reason,eventType,eventId,metadata,createdAt:now};
  const highest=Object.keys(order).filter(stage=>order[stage]<=Math.max(order[current.highestStage]||0,order[targetStage])).sort((a,b)=>order[b]-order[a])[0]||current.highestStage||current.stage;
  const next={...current,stage:targetStage,status:targetStage,stageSince:now,highestStage:highest,probability:STAGE_PROBABILITY[targetStage]??current.probability,updatedAt:now,updatedBy:actor?.id||"",version:Number(current.version||0)+1};
  return {ok:true,data:{...commercial,opportunities:(commercial.opportunities||[]).map(item=>item.id===opportunityId?next:item),stageEvents:[...(commercial.stageEvents||[]),event]},event};
};
