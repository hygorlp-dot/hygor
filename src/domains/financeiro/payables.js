// Posição de pagamento de documentos fiscais. Este módulo não conhece React,
// persistência ou conciliação: recebe uma nota e devolve somente sua posição.
import { active } from "./ledger.js";

export const totalPagoNota = nota =>
  (nota?.pagamentos || []).filter(active).reduce((total, pagamento) =>
    total + Number(pagamento?.valor || 0), 0);

export const saldoPagamentoNota = nota =>
  Math.max(0, Number(nota?.valorLiquido || nota?.valorBruto || 0) - totalPagoNota(nota));

// Nota que o razão não reconhece (cancelada, rejeitada ou estornada): não é
// obrigação a pagar nem prova de que o pedido tem nota.
export const notaSemEfeito = nota =>
  ["cancelada", "rejeitada", "estornada"].includes(String(nota?.status || "").toLowerCase());

export const statusPagamentoNota = nota => {
  if (nota?.status === "cancelada") return "cancelada";
  const total = Number(nota?.valorLiquido || nota?.valorBruto || 0);
  const pago = totalPagoNota(nota);
  if (nota?.status === "paga" || pago >= total - 0.01) return "paga";
  if (pago > 0) return "parcial";
  if (nota?.status === "aprovada") return "autorizada";
  return "conferencia";
};
