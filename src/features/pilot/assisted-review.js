import {criarFilaAutomatica} from '../../domains/conciliacao/automation.js';
import {criarRegistroIdentidades} from '../../domains/conciliacao/identity.js';
import {extrairContraparteDescricaoPix} from '../../domains/conciliacao/calculations.js';
import {reviewDocumentContext} from '../conciliacao/review-documents.js';

const digits=value=>String(value||'').replace(/\D/g,'');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(ltda|me|eireli|sa|s\/a)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export const identityLabels={fornecedor:'Fornecedor',operario:'Funcionário',cliente:'Cliente',terceirizado:'Terceiro',contratante:'Contratante'};
export function matchesAssistedQuery(row,query){
 const value=String(query||'').trim();if(!value)return true;
 const fold=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const bankDocument=row.tr.contraparteDocumento||row.tr.cpfCnpj||'';
 const documents=[bankDocument,...row.matches.flatMap(person=>person.documentos)];
 const text=JSON.stringify([row.tr.descricao,row.tr.data,row.tr.id,bankDocument,row.analise.melhorCandidata.titulo,row.analise.melhorCandidata.contraparte,row.matches.map(p=>[p.nome,p.documentos])]);
 return fold(text).includes(fold(value))||(/^[\d.\-/\s]+$/.test(value)&&digits(value).length>=4&&documents.some(document=>digits(document).includes(digits(value))));
}
export function assistedIdentityMatches(transaction,registry){
 const rawDocument=String(transaction.contraparteDocumento||transaction.cpfCnpj||'');
 const document=digits(rawDocument);
 const name=normalize(transaction.contraparteNome||transaction.nomeContraparte||extrairContraparteDescricaoPix(transaction.descricao));
 const validDocument=/^[\d.\-/\s]+$/.test(rawDocument)&&[11,14].includes(document.length);
 return registry.registros.filter(person=>identityLabels[person.tipo]).flatMap(person=>{
  const documentMatch=validDocument&&person.documentos.includes(document);
  const nameMatch=Boolean(name&&[person.nome,person.razaoSocial,person.nomeFantasia,...person.aliases].some(value=>normalize(value)===name));
  return documentMatch||nameMatch?[{...person,documentMatch,nameMatch,documentConflict:validDocument&&person.documentos.length>0&&!documentMatch}]:[];
 }).filter((person,index,all)=>all.findIndex(other=>other.tipo===person.tipo&&other.id===person.id)===index);
}
export function buildAssistedQueue(data){
 const registry=criarRegistroIdentidades(data);
 return criarFilaAutomatica(data).filter(row=>!row.automatica&&row.analise?.melhorCandidata).map(row=>({...row,matches:assistedIdentityMatches(row.tr,registry)}));
}
export function assistedDocuments(data,row){
 const candidate=row.analise.melhorCandidata;
 const supported=new Set(['nota','notaFiscal','pedido','outrasDesp','despesaEmpresa','medicao','medicaoTerc','tituloFolha','caixaObra']);
 const context=supported.has(candidate.tipo)?reviewDocumentContext(data,row.tr,{candidate}):{documents:[],unavailableDocuments:[]};
 const person=candidate.tipo==='funcionario'?(data.employees||[]).find(p=>String(p.id)===String(candidate.entidadeId)):candidate.tipo==='terceiro'?(data.terceirizados||[]).find(p=>String(p.id)===String(candidate.entidadeId)):null;
 return {bank:[...(row.tr.documentos||[]),...(row.tr.comprovantes||[])],target:[...context.documents,...context.unavailableDocuments,...(person?.documentos||[]),...(person?.comprovantes||[])]};
}
