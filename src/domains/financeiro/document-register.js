import {active,toCents} from './ledger.js';
import {financialEntry} from './workspace.js';
import {financialDocumentUrl as validLink} from './document-links.js';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const documentIssueLabels={review:'Aguardando conferência',missing:'Sem documento',work:'Sem obra',category:'Sem categoria',duplicate:'Possível duplicidade',mismatch:'Divergência informada'};
export function documentRegister(data,{competence='',obraId='all'}={}){
 const types=[['notasFiscais','nota_fiscal','Nota fiscal'],['pedidos','pedido','Pedido'],['medicoes','medicao','Medição'],['despesasEmpresa','despesa_empresa','Despesa da empresa'],['outrasDesp','outra_despesa','Despesa da obra']];
 const all=types.flatMap(([collection,type,label])=>(data[collection]||[]).filter(active).map(record=>{
  const date=record.emissao||record.dataEmissao||record.data||record.date||'',period=record.competencia||date.slice(0,7);
  const amount=record.valorBruto??record.valorPrevisto??record.valor??record.amount??record.valorTotal??0;
  const entry=financialEntry(data,{id:`${type}:${record.id}`,sourceType:type,sourceId:record.id,obraId:record.obraId,date,competence:period,amountCents:toCents(amount)});
  const docs=[...(record.documentos||[]),...(entry.documents||[]),...(record.pagamentos||[]).filter(active).flatMap(p=>p.comprovantes||[]),...(record.recebimentos||[]).filter(active).flatMap(r=>r.comprovantes||[])];
  const issues=[];
  if(type==='nota_fiscal'&&['recebida','conferencia',''].includes(record.status||''))issues.push('review');
  if(!docs.some(d=>validLink(d.url||d.webUrl||'')))issues.push('missing');
  if(type!=='despesa_empresa'&&!record.obraId&&!record.rateios?.some(r=>r.obraId))issues.push('work');
  if(['nota_fiscal','despesa_empresa','outra_despesa'].includes(type)&&!record.categoria)issues.push('category');
  if(record.divergencias?.length)issues.push('mismatch');
  const supplier=norm(record.documentoFornecedor||record.fornecedorId||record.fornecedorNome);
  return {id:entry.id,type,label,record,entry,period,docs,issues,signature:supplier&&toCents(amount)>0&&date?`${supplier}:${toCents(amount)}:${date}`:'',key:norm(record.chave)};
 }));
 for(const item of all){if(item.type!=='nota_fiscal')continue;item.duplicates=all.filter(o=>o.id!==item.id&&o.type==='nota_fiscal'&&((item.key&&o.key===item.key)||(item.signature&&o.signature===item.signature))).map(o=>o.record.numero||o.record.id);if(item.duplicates.length)item.issues.push('duplicate');}
 return all.filter(item=>(!competence||item.period===competence)&&(obraId==='all'||item.record.obraId===obraId||item.record.rateios?.some(r=>r.obraId===obraId)));
}
