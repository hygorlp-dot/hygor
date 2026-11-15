const active=invoice=>invoice.deletedAt==null&&invoice.ativo!==false&&!['cancelado','cancelada','estornado','estornada','rejeitada','rejeitado'].includes(String(invoice.status||'').trim().toLowerCase());
const digits=value=>String(value||'').replace(/\D/g,'');
const code=value=>{const text=String(value||'').trim().toUpperCase();return /^\d+$/.test(text)?text.replace(/^0+(?=\d)/,''):text;};
const documentIdentity=(data,invoice)=>{
 const supplier=(data.fornecedores||[]).find(item=>String(item.id)===String(invoice.fornecedorId||''));
 const document=digits(invoice.documentoFornecedor||supplier?.cnpj||supplier?.documento||supplier?.cpf);
 const issuer=[11,14].includes(document.length)?`document:${document}`:invoice.fornecedorId?`id:${invoice.fornecedorId}`:'';
 const number=code(invoice.numero),year=/^\d{4}-/.test(String(invoice.emissao||''))?invoice.emissao.slice(0,4):'';
 if(!issuer||!number||!year)return '';
 return JSON.stringify([String(invoice.tipo||'nfe').trim().toLowerCase(),issuer,code(invoice.serie),number,year]);
};

export function invoiceImportConflicts(data, imported, currentId='') {
  const candidates=(data.notasFiscais||[]).filter(invoice=>invoice.id!==currentId&&active(invoice));
  const identity=documentIdentity(data,imported);
  const duplicate=candidates.find(invoice=>(imported.chave&&String(invoice.chave||'').trim()===String(imported.chave).trim())
    ||(identity&&documentIdentity(data,invoice)===identity));
  const similar=candidates.filter(invoice=>digits(imported.documentoFornecedor)&&digits(invoice.documentoFornecedor)===digits(imported.documentoFornecedor)&&String(invoice.numero||'')===String(imported.numero||'')&&String(invoice.serie||'')===String(imported.serie||''));
  return {duplicate,similar:similar.filter(invoice=>invoice.id!==duplicate?.id)};
}
