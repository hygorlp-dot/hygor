const text=value=>String(value||"").trim();

export const isVisibleLead=lead=>!lead?.deletedAt&&String(lead?.status||"").toLowerCase()!=="excluido";

// "Excluir" no CRM retira o lead da operação, mas não apaga fatos relacionados.
// Propostas, contratos e reuniões realizadas continuam rastreáveis pelo leadId.
export const archiveLeadForDeletion=(commercial={},{
  leadId,actor={},now=new Date().toISOString(),
}={})=>{
  const leads=Array.isArray(commercial.leads)?commercial.leads:[];
  const lead=leads.find(item=>String(item.id)===String(leadId));
  if(!lead)return {ok:false,error:"Lead não encontrado.",commercial};
  if(!isVisibleLead(lead))return {ok:true,idempotent:true,commercial};
  const actorName=text(actor.nome||actor.email)||"Operador";
  const reason="Excluído do cadastro comercial pelo operador.";
  const archivedLead={
    ...lead,status:"arquivado",etapa:"arquivado",leadState:"arquivado",
    deletedAt:now,deletedById:text(actor.id),deletedBy:actorName,
    motivoArquivamento:reason,updatedAt:now,
    historico:[...(lead.historico||[]),{
      id:`lead-delete:${lead.id}:${now}`,data:now,tipo:"exclusao",
      texto:`Lead excluído por ${actorName}. Registros vinculados foram preservados.`,
    }],
  };
  const cancelPending=item=>String(item.leadId)===String(lead.id)
    &&!["concluida","realizada","cancelada"].includes(String(item.status||"").toLowerCase())
    ?{...item,status:"cancelada",canceladoEm:now,canceladoPorId:text(actor.id),canceladoPor:actorName,motivoCancelamento:"Lead excluído."}
    :item;
  const opportunities=(commercial.opportunities||[]).map(item=>
    String(item.leadId)===String(lead.id)&&!["ganho","perdido","arquivado"].includes(String(item.stage||"").toLowerCase())
      ?{...item,stage:"arquivado",status:"arquivado",forecastCategory:"arquivado",probability:0,stageSince:now,updatedAt:now,version:Number(item.version||0)+1}
      :item);
  const archivedOpportunityIds=new Set(opportunities
    .filter(item=>String(item.leadId)===String(lead.id)&&item.stage==="arquivado")
    .map(item=>String(item.id)));
  const stageEvents=archivedOpportunityIds.size?[...(commercial.stageEvents||[]),...opportunities
    .filter(item=>archivedOpportunityIds.has(String(item.id)))
    .map(item=>({
      id:`lead-delete-event:${item.id}:${now}`,opportunityId:item.id,
      etapaAnterior:"",etapaNova:"arquivado",entrouEm:now,
      autorId:text(actor.id),autorNome:actorName,
      motivo:reason,eventType:"lead_deleted",createdAt:now,
    }))]:(commercial.stageEvents||[]);
  return {
    ok:true,
    commercial:{
      ...commercial,
      leads:leads.map(item=>String(item.id)===String(lead.id)?archivedLead:item),
      atividades:(commercial.atividades||[]).map(cancelPending),
      reunioes:(commercial.reunioes||[]).map(cancelPending),
      opportunities,
      stageEvents,
    },
  };
};
