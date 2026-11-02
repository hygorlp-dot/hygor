const INACTIVE = new Set([
  "cancelado", "cancelada", "cancelled", "canceled",
  "rejeitado", "rejeitada", "rejected",
  "rascunho", "draft",
  "estornado", "estornada", "reversed", "reverted",
  "excluido", "excluida", "deleted",
]);
export const statusOf=item=>String(item?.status||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const active = item => item?.deletedAt == null && item?.ativo !== false && !INACTIVE.has(statusOf(item));
export const toCents=value=>Math.round(Number(value||0)*100);

export const notaReconhecivel=invoice=>active(invoice)&&(!statusOf(invoice)||["recebida","aprovada","paga","conferida","reconhecida"].includes(statusOf(invoice)));
