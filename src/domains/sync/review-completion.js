import {canRecoverSnapshot,expandSnapshot} from './snapshot-journal.js';
import {reviewSnapshot} from './snapshot-merge.js';

export async function completeProtectedReview({row,user,journal,readCurrent,normalize,onComplete}){
 const fresh=await readCurrent();
 if(!fresh?.ok)return {ok:false,reason:fresh?.error||'Não foi possível conferir a versão atual.'};
 const latest=await journal.readLatest(user.id,row.tab);
 if(!latest||latest.revision!==row.revision)return {ok:false,reason:'A edição local mudou. Consulte a versão atual novamente.'};
 const account=fresh.usuario||user,data=normalize(fresh.data);
 if(!canRecoverSnapshot(latest,account,data))return {ok:false,reason:'Seu acesso mudou. A edição foi preservada para revisão.'};
 const expanded=expandSnapshot(latest.changes,data);
 if(reviewSnapshot(expanded.base,expanded.intended,data).changes.length)return {ok:false,reason:'A versão do servidor mudou. Consulte e revise a edição novamente.'};
 if(!onComplete)return {ok:false,reason:'Não foi possível encerrar a conferência. A edição continua protegida.'};
 return onComplete({...fresh,data},latest);
}

const areas={planos:'Planejamento',orcamentos:'Orçamento',obras:'Obras',employees:'Equipe',comercial:'Comercial',fornecedores:'Fornecedores',eventosEmpresa:'Eventos da empresa',config:'Configurações',conciliacao:'Conciliação',extratos:'Extratos',transacoes:'Movimentos bancários'};
export function protectedEditAreas(row){
 return [...new Set(Object.keys(row?.changes||{}).map(key=>areas[key]||'Outros cadastros'))].join(', ')||'Área a conferir';
}
