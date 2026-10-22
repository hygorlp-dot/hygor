// Controle da substituição administrativa das condições comerciais de uma locação.
// Não cria aditivo nem histórico comercial: serve para corrigir o snapshot vigente
// enquanto ainda não há efeito financeiro consolidado. O backend continua usando
// versionamento/idempotência para evitar gravações concorrentes.

const list = (data, key) => Array.isArray(data?.[key]) ? data[key] : [];
const inactiveStatuses = new Set(["cancelled", "canceled", "cancelada"]);
const active = item => !inactiveStatuses.has(String(item?.status || "").toLowerCase());

export function rentalCommercialOverrideStatus(data = {}, rentalId = "") {
  const id = String(rentalId || "");
  const chargeItems = list(data, "rentalChargeItems").filter(item =>
    String(item.rentalId || "") === id && active(item));
  const allInvoices = list(data, "rentalInvoices").filter(item =>
    String(item.rentalId || "") === id);
  const invoices = allInvoices.filter(active);
  const allInvoiceIds = new Set(allInvoices.map(item => String(item.id || "")));
  const receipts = list(data, "rentalInvoiceReceipts").filter(item =>
    allInvoiceIds.has(String(item.invoiceId || "")));

  if (receipts.length) {
    return { allowed: false, reason: "A locação já possui recebimento vinculado. As condições comerciais não podem ser substituídas silenciosamente.", chargeItems, invoices, receipts };
  }
  if (invoices.length) {
    return { allowed: false, reason: "A locação já possui fatura emitida. As condições comerciais não podem ser substituídas silenciosamente.", chargeItems, invoices, receipts };
  }
  if (chargeItems.length) {
    return { allowed: false, reason: "A locação já possui medição ou linha de cobrança. As condições comerciais não podem ser substituídas silenciosamente.", chargeItems, invoices, receipts };
  }
  return { allowed: true, reason: "", chargeItems, invoices, receipts };
}
