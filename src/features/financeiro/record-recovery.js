const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
const stable=value=>JSON.stringify(ordered(value));
export const invoiceRecoveryFields=['tipo','numero','serie','chave','emissao','vencimento','fornecedorNome','documentoFornecedor','obraId','pedidoId','valorBruto','valorLiquido','retencoes','rateios','documentos','itensNota','categoria'];
export const formatInvoiceEditor=record=>({...record,valorBruto:String(record.valorBruto??''),valorLiquido:String(record.valorLiquido??''),retencoes:{iss:0,inss:0,irrf:0,pis:0,cofins:0,csll:0,outros:0,...record.retencoes},rateios:record.rateios||[],documentos:record.documentos||[],pagamentos:record.pagamentos||[],divergencias:record.divergencias||[]});
export const recoveryFieldLabel=field=>({tipo:'Tipo',numero:'Número',serie:'Série',chave:'Chave de acesso',emissao:'Emissão',vencimento:'Vencimento',fornecedorNome:'Fornecedor',documentoFornecedor:'Documento do fornecedor',obraId:'Obra',pedidoId:'Pedido relacionado',valorBruto:'Valor bruto',valorLiquido:'Valor líquido',retencoes:'Retenções',rateios:'Rateios',documentos:'Referências documentais',itensNota:'Itens da nota',categoria:'Categoria'}[field]||'Dados da origem');
export const sameRecordValue=(a,b)=>stable(a)===stable(b);
export function mergeRecordEdits(base,draft,current,fields,choices={}){
 const merged={...current},conflicts=[];
 for(const field of fields){
  const changed=!sameRecordValue(draft[field],base[field]);
  const concurrent=!sameRecordValue(current[field],base[field]);
  if(changed&&concurrent&&!sameRecordValue(draft[field],current[field])){
   if(!choices[field])conflicts.push(field);
   merged[field]=choices[field]==='current'?current[field]:draft[field];
  }else if(changed)merged[field]=draft[field];
 }
 return {merged,conflicts};
}
