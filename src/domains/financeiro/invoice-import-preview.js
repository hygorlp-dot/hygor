const active=invoice=>!['cancelado','cancelada','estornado','rejeitada'].includes(String(invoice.status||'').toLowerCase());
const digits=value=>String(value||'').replace(/\D/g,'');

export function invoiceImportConflicts(data, imported, currentId='') {
  const candidates=(data.notasFiscais||[]).filter(invoice=>invoice.id!==currentId&&active(invoice));
  const duplicate=candidates.find(invoice=>imported.chave&&String(invoice.chave||'')===String(imported.chave));
  const similar=candidates.filter(invoice=>digits(imported.documentoFornecedor)&&digits(invoice.documentoFornecedor)===digits(imported.documentoFornecedor)&&String(invoice.numero||'')===String(imported.numero||'')&&String(invoice.serie||'')===String(imported.serie||''));
  return {duplicate,similar:similar.filter(invoice=>invoice.id!==duplicate?.id)};
}
