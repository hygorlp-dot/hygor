import { COMMERCIAL_SCHEMA_VERSION, LEGACY_STAGE_MAP, LEAD_STATES, STAGE_PROBABILITY } from "./constants.js";
import { canonicalActivities, nextActivityFor } from "./activities.js";
import { normalizeRealEstateCommercial } from "./real-estate.js";
export const migrateCommercial=(commercial={})=>{
  if(Number(commercial.schemaVersion||0)>=COMMERCIAL_SCHEMA_VERSION)return normalizeRealEstateCommercial(commercial);
  const leads=(commercial.leads||[]).map(lead=>({...lead,leadState:lead.leadState||(["novo","primeiro_contato"].includes(lead.etapa)?"novo":["qualificacao","aguardando_info"].includes(lead.etapa)?"em_atendimento":lead.etapa==="perdido"?"desqualificado":lead.etapa==="arquivado"?"arquivado":"qualificado")}));
  const existing=new Map((commercial.opportunities||[]).map(item=>[item.leadId,item]));const now=new Date().toISOString();
  const opportunities=[...(commercial.opportunities||[])];const stageEvents=[...(commercial.stageEvents||[])];
  leads.forEach(lead=>{const stage=LEGACY_STAGE_MAP[lead.etapa];if(!stage||existing.has(lead.id))return;const id=`opp:${lead.id}`;const createdAt=lead.createdAt||now;opportunities.push({id,leadId:lead.id,titulo:lead.nome,servico:lead.servico||"",stage,substatus:lead.etapa||"",stageSince:lead.etapaDesde||createdAt,highestStage:stage,ownerId:lead.responsavelId||"",estimatedValue:Number(lead.orcamentoEstimado||0),probability:Number(lead.probabilidade||STAGE_PROBABILITY[stage]),forecastCategory:stage,expectedCloseDate:lead.fechamentoPrevisto||"",source:lead.origem||"",city:lead.cidade||"",status:stage,createdAt,updatedAt:createdAt,version:1});stageEvents.push({id:`migration:${id}`,opportunityId:id,etapaAnterior:"",etapaNova:stage,entrouEm:createdAt,autorId:"migration",autorNome:"Migração",motivo:"Migração idempotente do funil legado",eventType:"migration",createdAt});});
  const activities=canonicalActivities({...commercial,leads});const migratedLeads=leads.map(lead=>{const next=nextActivityFor(activities,{leadId:lead.id});return {...lead,proximaAtividade:next?.title||lead.proximaAtividade||"",proximaAtividadeEm:next?.dataHora||lead.proximaAtividadeEm||""};});
  return normalizeRealEstateCommercial({...commercial,schemaVersion:COMMERCIAL_SCHEMA_VERSION,leads:migratedLeads,opportunities,stageEvents});
};
