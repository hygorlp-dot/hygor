export function accountReviewSummary(data) {
  const statements = data.dreBankSource?.extratos || data.extratos || [];
  const archived = new Set(statements.filter(e => e.status === "arquivado").map(e => String(e.id)));
  const accounts = new Map((data.dreBankSource?.contasBancarias || data.contasBancarias || []).map(a => [String(a.id), { id: String(a.id), nome: a.nome, pending: 0, pendingValue: 0, lastImport: "" }]));
  for (const tr of data.transacoes || []) {
    if (archived.has(String(tr.extratoId))) continue;
    const id = String(tr.contaBancariaId || "unassigned");
    if (!accounts.has(id)) accounts.set(id, { id, nome: id === "unassigned" ? "Sem conta definida" : "Conta não cadastrada", pending: 0, pendingValue: 0, lastImport: "" });
    if (["pendente", "parcial"].includes(tr.status)) {
      const row = accounts.get(id);
      row.pending++;
      row.pendingValue += tr.status === "parcial" ? Number(tr.saldoNaoVinculado || 0) : Math.abs(Number(tr.valor || 0));
    }
  }
  for (const ext of statements) {
    if (ext.status === "arquivado") continue;
    const row = accounts.get(String(ext.contaBancariaId || "unassigned"));
    if (row && String(ext.importadoEm || "") > row.lastImport) row.lastImport = ext.importadoEm;
  }
  return [...accounts.values()];
}

const historyTypes = new Map(Object.entries({
  caixaObra:'Caixa da obra', despesasEmpresa:'Despesa da empresa', outrasDesp:'Despesa da obra',
  payments:'Recebimento', pagamentoNota:'Pagamento de nota', pagamentoPedido:'Pagamento de pedido',
  recebimentoMedicao:'Recebimento de medição', recebimentoEntradaContrato:'Recebimento de contrato',
  pagsTerceiros:'Pagamento de terceiro', pagamentoFolha:'Pagamento de folha',
  liquidacaoFolha:'Liquidação de folha', transferenciaInterna:'Transferência interna',
}));

const historyLabels = new Map(Object.entries({
  id:'Registro', entidadeId:'Origem', conciliacaoId:'Conciliação', reconciliationLinkId:'Vínculo de conciliação',
}));

export function reconciliationHistoryDetails(value, depth=0) {
  if(typeof value==='string')return value;
  if(typeof value==='number')return String(value);
  if(typeof value==='boolean')return value?'Sim':'Não';
  if(!value||typeof value!=='object')return '';
  if(depth>=4)return 'Detalhes adicionais no registro original';
  if(Array.isArray(value))return value.map(item=>reconciliationHistoryDetails(item,depth+1)).filter(Boolean).join(' | ');
  return Object.entries(value).map(([key,detail])=>{
    const text=reconciliationHistoryDetails(detail,depth+1);
    if(!text)return '';
    if(key==='tipo')return historyTypes.get(text)||text;
    const label=historyLabels.get(key)||key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ');
    return `${label} ${text}`;
  }).filter(Boolean).join(' · ');
}
