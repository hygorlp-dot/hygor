const pending=item=>["pendente","em_andamento"].includes(item.status||"pendente");
export const canonicalActivities=commercial=>[
  ...(commercial?.atividades||[]).map(item=>({...item,title:item.titulo||"Atividade",kind:item.tipo||"tarefa",status:item.status||"pendente"})),
  ...(commercial?.reunioes||[]).map(item=>({id:`meeting:${item.id}`,legacyMeetingId:item.id,kind:item.tipo?.includes("online")?"reuniao_online":"reuniao_presencial",title:item.titulo||"Reunião",leadId:item.leadId||"",opportunityId:item.opportunityId||"",responsavelId:item.responsavelComercialId||"",dataHora:item.dataHora,status:item.status==="realizada"?"concluida":item.status==="cancelada"?"cancelada":"pendente",resultado:item.resumo||"",createdAt:item.createdAt||""})),
];
export const nextActivityFor=(activities,{leadId="",opportunityId=""},now=Date.now())=>activities.filter(item=>pending(item)&&item.dataHora&&(leadId?item.leadId===leadId:true)&&(opportunityId?item.opportunityId===opportunityId:true)).sort((a,b)=>new Date(a.dataHora)-new Date(b.dataHora))[0]||null;
export const activityPriority=(activity,now=Date.now())=>!activity?3:new Date(activity.dataHora).getTime()<now?0:new Date(activity.dataHora).toDateString()===new Date(now).toDateString()?1:3;
