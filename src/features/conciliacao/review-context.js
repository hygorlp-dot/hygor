export function accountReviewSummary(data) {
  const archived = new Set((data.extratos || []).filter(e => e.status === "arquivado").map(e => String(e.id)));
  const accounts = new Map((data.contasBancarias || []).map(a => [String(a.id), { id: String(a.id), nome: a.nome, pending: 0, pendingValue: 0, lastImport: "" }]));
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
  for (const ext of data.extratos || []) {
    if (ext.status === "arquivado") continue;
    const row = accounts.get(String(ext.contaBancariaId || "unassigned"));
    if (row && String(ext.importadoEm || "") > row.lastImport) row.lastImport = ext.importadoEm;
  }
  return [...accounts.values()];
}
