// Posição de pagamento de documentos fiscais. Este módulo não conhece React,
// persistência ou conciliação: recebe uma nota e devolve somente sua posição.
export const totalPagoNota = nota =>
  (nota?.pagamentos || []).reduce((total, pagamento) =>
    total + Number(pagamento?.valor || 0), 0);

export const saldoPagamentoNota = nota =>
  Math.max(0, Number(nota?.valorLiquido || nota?.valorBruto || 0) - totalPagoNota(nota));

export const statusPagamentoNota = nota => {
  if (nota?.status === "cancelada") return "cancelada";
  const total = Number(nota?.valorLiquido || nota?.valorBruto || 0);
  const pago = totalPagoNota(nota);
  if (nota?.status === "paga" || pago >= total - 0.01) return "paga";
  if (pago > 0) return "parcial";
  if (nota?.status === "aprovada") return "autorizada";
  return "conferencia";
};
