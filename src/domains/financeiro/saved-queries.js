import {documentIssueLabels} from './document-register.js';

export function queryStorageKey(user,config={}){
 const company=String(config.companyId||config.cnpj||'').replace(/\s/g,'');
 return user?.id&&company?`marcell:document-queries:v1:${encodeURIComponent(company)}:${encodeURIComponent(user.id)}:${encodeURIComponent(user.obraId||'all')}`:null;
}
export function sanitizeQuery(value={}){
 return {query:typeof value.query==='string'?value.query.slice(0,120):'',filter:value.filter==='all'||Object.hasOwn(documentIssueLabels,value.filter)?value.filter:'all',competence:/^\d{4}-(0[1-9]|1[0-2])$/.test(value.competence)?value.competence:'',obraId:typeof value.obraId==='string'?value.obraId.slice(0,120):'all'};
}
export function restoreQuery(value,{works=[],currentWork='all',restrictedWork=''}={}){
 const result=sanitizeQuery(value),messages=[];
 const available=work=>works.some(w=>String(w.id)===String(work)&&w.ativo!==false&&!w.deletedAt);
 if(result.obraId!=='all'&&!available(result.obraId)||restrictedWork&&result.obraId!==restrictedWork){result.obraId=restrictedWork||(available(currentWork)?currentWork:'all');messages.push('A obra salva não está disponível. Aplicado o recorte de acesso atual.');}
 if(value.filter!==result.filter)messages.push('O filtro salvo foi atualizado para as situações disponíveis.');
 if(value.competence!==result.competence)messages.push('O mês salvo era inválido e foi removido.');
 return {value:result,message:messages.join(' ')};
}
export function readQueries(storage,key){
 if(!key)return [];
 try{const rows=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(rows)?rows.filter(r=>typeof r.id==='string'&&typeof r.name==='string'&&r.value&&typeof r.value==='object').slice(0,20).map(r=>({id:r.id.slice(0,80),name:r.name.slice(0,60),value:{...sanitizeQuery(r.value),filter:typeof r.value.filter==='string'?r.value.filter.slice(0,60):'all',competence:typeof r.value.competence==='string'?r.value.competence.slice(0,12):''}})):[];}catch{return [];}
}
