import {active} from './ledger.js';
import {financialDocumentUrl} from './document-links.js';
import {isDateInClosedPeriod,isCompetenceInClosedPeriod} from './workflows.js';
import {podeAcessarAba} from '../administracao/abas-acesso.js';
import {workExpenseCategories} from '../dre/work-expense-categories.js';
import {companyExpenseCategoryOptions} from '../dre/expense-taxonomy.js';

export const CLOSING_CORRECTION_COMMAND={CLOSING_SOURCE_CORRECTED:'ORIGEM_FECHAMENTO_CORRIGIDA'};
export const closingSources={pedido:{collection:'pedidos',tab:'cmp'},medicao:{collection:'medicoes',tab:'medicoes'},despesa_empresa:{collection:'despesasEmpresa',tab:'dre_emp'},outra_despesa:{collection:'outrasDesp',tab:'dre'}};
export const closingSource=(data,payload)=>{
 const spec=closingSources[payload?.sourceType];
 return spec&&(data[spec.collection]||[]).find(r=>String(r.id)===String(payload.sourceId));
};
export function closingCorrectionScope({user={},data={},command={}}){
 const spec=closingSources[command.payload?.sourceType],record=closingSource(data,command.payload);
 if(!spec||!record||!active(record))return {ok:false,error:'A origem não está disponível para correção.'};
 if(!['admin','financeiro'].includes(user.role)||!podeAcessarAba(user,'fin')||!podeAcessarAba(user,spec.tab))return {ok:false,error:'Seu acesso não permite corrigir esta origem.'};
 if(user.obraId&&String(user.obraId)!==String(record.obraId||''))return {ok:false,error:'A origem está fora da obra permitida.'};
 return {ok:true,obraId:record.obraId||'',scope:record.obraId?'work':'company'};
}
export function applyClosingCorrection(data,command,now){
 if(command.type!==CLOSING_CORRECTION_COMMAND.CLOSING_SOURCE_CORRECTED)return null;
 const fail=reason=>({ok:false,reason});
 const p=command.payload||{},spec=closingSources[p.sourceType],current=closingSource(data,p);
 if(!spec||!current||!active(current))return fail('A origem não está disponível para correção.');
 if(!command.actorId)return fail('Sessão indisponível. Renove o acesso antes de confirmar.');
 if(!Number.isInteger(command.expectedVersion)||command.expectedVersion!==Number(current.version||0))return {ok:false,code:'VERSION_CONFLICT',reason:'O registro foi alterado por outra pessoa. Confira a versão atual antes de confirmar.'};
 if(typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>2000)return fail('Informe o motivo da correção, com até 2.000 caracteres.');
 const changes=p.changes||{};
 const allowed=['documentos',...(['despesa_empresa','outra_despesa'].includes(p.sourceType)?['categoria']:[])];
 if(!Object.keys(changes).length||Object.keys(changes).some(k=>!allowed.includes(k)))return fail('A correção permite somente categoria e referências documentais.');
 const date=current.emissao||current.dataEmissao||current.data||current.date;
 if(isDateInClosedPeriod(data,date)||isCompetenceInClosedPeriod(data,current.competencia||String(date||'').slice(0,7)))return fail('O período está fechado. A correção depende da política de reabertura existente.');
 const categories=p.sourceType==='despesa_empresa'?companyExpenseCategoryOptions():workExpenseCategories(data);
 if('categoria' in changes&&(typeof changes.categoria!=='string'||!changes.categoria.trim()||changes.categoria.length>120||changes.categoria!==current.categoria&&!categories.some(c=>c.v===changes.categoria)))return fail('Informe uma categoria válida do cadastro da origem.');
 if(current.transacaoId&&changes.categoria!==undefined&&changes.categoria!==current.categoria)return fail('Desfaça a conciliação na origem antes de reclassificar este registro.');
 if(changes.documentos!==undefined&&(!Array.isArray(changes.documentos)||changes.documentos.length>100||changes.documentos.some(d=>!d||typeof d!=='object'||!financialDocumentUrl(d.url||d.webUrl)&&!(d.id&&d.driveId))))return fail('Informe referências documentais válidas.');
 const next={...current,...changes,version:Number(current.version||0)+1,updatedAt:now,updatedById:command.actorId,
  historicoCorrecoesFechamento:[...(current.historicoCorrecoesFechamento||[]),{at:now,actorId:command.actorId,actorName:command.actorName||'',reason:String(p.reason).trim(),before:Object.fromEntries(Object.keys(changes).map(k=>[k,current[k]??null])),after:changes}]};
 return {ok:true,entityId:current.id,data:{...data,[spec.collection]:data[spec.collection].map(r=>r.id===current.id?next:r)}};
}
