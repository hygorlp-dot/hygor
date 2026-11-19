import {podeAcessarAba} from '../administracao/abas-acesso.js';

export function pendingApprovalStages(data,user){
 if(!user?.id||user.active===false||!podeAcessarAba(user,'aprov_pend'))return [];
 return (data.instanciasAprovacao||[]).filter(i=>i.status==='em_andamento'&&Array.isArray(i.snapshotPolitica?.etapas))
  .filter(i=>!user?.obraId||i.contexto?.obraId===user.obraId)
  .map(instancia=>({instancia,etapas:instancia.snapshotPolitica.etapas
   .map((etapa,index)=>({etapa,resultado:instancia.resultadosEtapas?.[index]}))
   .filter(({resultado})=>resultado?.status==='em_andamento'&&(resultado.aprovadoresElegiveis||[]).some(u=>u.id===user?.id))}))
  .filter(item=>item.etapas.length);
}

// An incompatible/missing snapshot is a diagnostic, never permission to decide.
export function requestsWithoutApprovalFlow(data,user){
 if(!user?.id||user.active===false||!podeAcessarAba(user,'cmp'))return [];
 return (data.solicitacoesCompra||[]).filter(s=>s.ativo!==false&&!s.deletedAt&&!['cancelada','pedido_gerado'].includes(s.status)
   &&(['enviada','em_analise'].includes(s.status)||!!s.aprovacaoInstanciaId)&&(!user.obraId||s.obraId===user.obraId))
  .filter(s=>{const i=(data.instanciasAprovacao||[]).find(item=>item.id===s.aprovacaoInstanciaId&&item.entidadeTipo==='solicitacaoCompra'&&item.entidadeId===s.id);
   return !i||(['em_andamento','bloqueada'].includes(i.status)&&(!Array.isArray(i.snapshotPolitica?.etapas)||!i.snapshotPolitica.etapas.length));
  });
}
