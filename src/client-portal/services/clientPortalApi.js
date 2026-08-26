async function request(url, options = {}) {
  const response=await fetch(url,{credentials:"same-origin",...options});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(body.error || "Não foi possível concluir a operação.");error.status=response.status;throw error;}
  return body;
}

export const readClientPortalSession=()=>request("/api/client/auth/session");
export const readClientPortalDashboard=projectId=>request(`/api/client/projects/${encodeURIComponent(projectId)}/dashboard`);

const normalizeLegacyPortal = source => {
  const portal=source?.portal || {};
  const obra=portal.obra || {};
  return {
    project:{
      id:obra.id || "", name:obra.nome || "Acompanhamento da obra",
      coverImage:obra.capaUrl || "", progress:Number(portal.progresso || 0),
      currentPhase:obra.status || "", estimatedCompletion:obra.terminoPrevisto || "",
      lastUpdate:portal.atualizadoEm || "",
    },
    timeline:(portal.cronograma || []).map(item=>({
      id:item.id, phase:item.nome, status:item.progresso>=100?"Concluído":"Em andamento",
      plannedStart:item.inicio, plannedEnd:item.fim, progress:Number(item.progresso || 0),
    })),
    weeklyUpdates:(portal.atualizacoes || []).slice(0,8).map(item=>({
      id:item.id, period:item.at, summary:item.mensagem, authorName:item.responsavel,
    })),
    publishedMedia:(portal.fotos || []).map((item,index)=>({
      id:`foto-${index}-${item.data || ""}`, url:item.url, caption:item.legenda,
      date:item.data,
    })),
    measurements:(portal.medicoes || []).map(item=>({
      id:item.id, number:item.descricao, period:item.competencia,
      amount:Number(item.valorPrevisto || 0), status:item.recebido?"Recebida":"Publicada",
    })),
    payments:(portal.medicoes || []).filter(item=>item.recebido).map(item=>({
      id:`pag-${item.id}`, description:item.descricao, amount:Number(item.valorRecebido || 0),
      status:"Recebido",
    })),
    publishedDocuments:(portal.documentos || []).map(item=>({
      id:item.id, title:item.nome, url:item.url, category:"Documento da obra",
    })),
    projectCashSummary:portal.caixaResumo ? [portal.caixaResumo] : [],
    projectCashMovements:portal.caixaMovimentacoes || [],
    invoices:portal.notasFiscais || [],
    purchaseOrders:portal.compras || [],
    quotations:portal.cotacoes || [],
    decisions:[],
  };
};

export async function readClientPortalByLink(projectId, token) {
  const response=await fetch("/api/data",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"client-portal",obraId:projectId,token}),
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(body.error || "Link inválido ou revogado.");error.status=response.status;throw error;}
  return normalizeLegacyPortal(body);
}
