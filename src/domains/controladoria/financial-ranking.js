import { statusRecebimentoMedicao } from "../conciliacao/calculations.js";
import { saldoPagamentoNota } from "../financeiro/payables.js";

const limitarNota = valor => Math.max(0, Math.min(100, Number(valor) || 0));

// Serviço de controladoria: agrega o DRE canônico e evidências operacionais
// para priorizar obras. A fórmula não conhece cores, componentes ou navegação.
export const createFinancialRankingEngine = ({ calculateWorkDre } = {}) => {
  if (typeof calculateWorkDre !== "function") {
    throw new TypeError("Ranking financeiro requer o cálculo canônico do DRE por obra.");
  }

  const calculateFinancialRanking = (data, year, month, obraId = "") => {
    const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
    const endDate = `${ym}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;
    const works = (data?.obras || []).filter(work => !obraId || work.id === obraId);
    const rows = works.map(work => {
      const dre = calculateWorkDre(data, work.id, year, month);
      const invoices = (data?.notasFiscais || []).filter(invoice =>
        invoice.obraId === work.id
        && invoice.status !== "cancelada"
        && String(invoice.emissao || invoice.criadoEm || endDate).slice(0, 10) <= endDate);
      const overdueInvoices = invoices.filter(invoice =>
        saldoPagamentoNota(invoice) > 0.01
        && invoice.vencimento
        && invoice.vencimento <= endDate).length;
      const orders = (data?.pedidos || []).filter(order =>
        order.obraId === work.id
        && !["cancelado", "rascunho"].includes(order.status)
        && String(order.data || endDate).slice(0, 10) <= endDate);
      const invoicedOrderIds = new Set(invoices.map(invoice => invoice.pedidoId).filter(Boolean));
      const ordersWithoutInvoice = orders.filter(order => !invoicedOrderIds.has(order.id)).length;
      const payments = [
        ...orders.flatMap(order => order.pagamentos || []),
        ...invoices.flatMap(invoice => invoice.pagamentos || []),
      ];
      const paymentIds = new Set();
      const uniquePayments = payments.filter(payment => {
        if (paymentIds.has(payment.id)) return false;
        paymentIds.add(payment.id);
        return true;
      });
      const unreconciledPayments = uniquePayments.filter(payment =>
        !payment.conciliado
        && String(payment.data || endDate).slice(0, 10) <= endDate).length;
      const overdueReceivables = (data?.medicoes || []).filter(measurement =>
        measurement.obraId === work.id
        && statusRecebimentoMedicao(measurement) !== "recebida"
        && measurement.dataVencimento
        && measurement.dataVencimento <= endDate).length;
      const hasMovement = dre.faturamento > 0
        || dre.recebido > 0
        || dre.totalCustos > 0
        || dre.faturadoAcum > 0
        || invoices.length > 0
        || orders.length > 0;
      if (!hasMovement) return null;

      const marginPct = dre.faturamento > 0 ? dre.margemBruta : (dre.totalCustos > 0 ? -100 : 0);
      const marginIndex = dre.faturamento > 0
        ? limitarNota((marginPct + 10) / 35 * 100)
        : (dre.totalCustos > 0 ? 0 : 50);
      const receiptPct = dre.faturamento > 0
        ? dre.recebido / dre.faturamento * 100
        : (dre.faturadoAcum > 0 ? dre.recebidoAcum / dre.faturadoAcum * 100 : 50);
      const receiptIndex = limitarNota(receiptPct);
      const cashMargin = dre.recebido > 0 ? dre.margemCaixa : (dre.totalCustos > 0 ? -100 : 0);
      const cashIndex = dre.recebido > 0
        ? limitarNota((cashMargin + 30) / 50 * 100)
        : (dre.totalCustos > 0 ? 0 : 50);
      const complianceIndex = limitarNota(
        100
        - Math.min(45, overdueInvoices * 18)
        - Math.min(30, ordersWithoutInvoice * 10)
        - Math.min(25, unreconciledPayments * 8),
      );
      const score = Math.round(
        marginIndex * 0.35
        + receiptIndex * 0.25
        + cashIndex * 0.20
        + complianceIndex * 0.20,
      );
      const range = score >= 90
        ? { conceito:"A+", situacao:"Excelente" }
        : score >= 80
          ? { conceito:"A", situacao:"Saudável" }
          : score >= 70
            ? { conceito:"B", situacao:"Estável" }
            : score >= 55
              ? { conceito:"C", situacao:"Atenção" }
              : { conceito:"D", situacao:"Crítica" };
      const alerts = [];
      if (dre.lucroBruto < 0) alerts.push("resultado negativo");
      if (receiptPct < 80 && dre.faturamento > 0) alerts.push("recebimento abaixo de 80%");
      if (dre.saldoCaixa < 0) alerts.push("caixa do período negativo");
      if (overdueInvoices) alerts.push(`${overdueInvoices} nota(s) vencida(s)`);
      if (ordersWithoutInvoice) alerts.push(`${ordersWithoutInvoice} pedido(s) sem NF`);
      if (unreconciledPayments) alerts.push(`${unreconciledPayments} pagamento(s) a conciliar`);
      if (overdueReceivables) alerts.push(`${overdueReceivables} recebível(is) vencido(s)`);
      return {
        id:work.id,
        nome:work.name || "Obra",
        codigo:work.code || work.codigo || "",
        nota:score,
        faixa:range,
        conceito:range.conceito,
        situacao:range.situacao,
        alertas:alerts,
        faturamento:dre.faturamento,
        recebido:dre.recebido,
        custos:dre.totalCustos,
        resultado:dre.lucroBruto,
        margemPct:marginPct,
        recebimentoPct:receiptPct,
        saldoCaixa:dre.saldoCaixa,
        notasVencidas:overdueInvoices,
        pedidosSemNota:ordersWithoutInvoice,
        naoConciliados:unreconciledPayments,
        recebiveisVencidos:overdueReceivables,
        indices:{
          margem:Math.round(marginIndex),
          recebimento:Math.round(receiptIndex),
          caixa:Math.round(cashIndex),
          conformidade:Math.round(complianceIndex),
        },
      };
    }).filter(Boolean).sort((left, right) =>
      right.nota - left.nota
      || right.resultado - left.resultado
      || left.nome.localeCompare(right.nome));

    return rows.map((row, index) => ({ ...row, posicao:index + 1 }));
  };

  return { calculateFinancialRanking };
};
