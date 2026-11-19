import {podeAcessarAba} from '../../domains/administracao/abas-acesso.js';

export function conferenceTasks(data,user){
 if(!user?.id||user.active===false||!podeAcessarAba(user,'conferencia')||!['admin','engenheiro','engenheiro_auditor'].includes(user.role))return [];
 return (data.conferencias||[]).filter(c=>!user.obraId||c.obraId===user.obraId)
  .flatMap(c=>(c.pendencias||[]).filter(p=>user.role!=='engenheiro'||p.responsavelAjusteId===user.id).map(p=>({
   conferenceId:c.id,findingId:p.id,code:`CONF-${String(c.codigo).padStart(3,'0')}`,workId:c.obraId,
   work:(data.obras||[]).find(o=>o.id===c.obraId)?.name||'Obra não disponível',
   title:p.descricao,owner:p.responsavelAjusteNome||(data.usuarios||[]).find(u=>u.id===p.responsavelAjusteId)?.nome||'Responsável não definido',
   reviewer:c.responsavel||'Vistoriador não informado',deadline:p.prazo||'',status:c.status==='cancelada'?'cancelada':p.status||'aberta',
   resolvedAt:p.resolvidoEm||p.validadoEm||'',resolvedBy:p.validadoPor||'',
   terminal:['resolvida','cancelada'].includes(p.status)||c.status==='cancelada',
  })))
  .sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999'));
}
