import { activeCashAllocations } from "../conciliacao/cash-allocations.js";
import { recebimentosDaMedicao } from "./ledger.js";

export function clientMeasurementBankIds(data, measurement) {
  const receipts = recebimentosDaMedicao(measurement);
  const eventIds = new Set(receipts.map(item => `medicao:${measurement.id}:receipt:${item.id}:cash`));
  return [...new Set([
    ...receipts.map(item => item.transacaoId),
    ...activeCashAllocations(data).filter(link => eventIds.has(link.eventId)).map(link => link.transactionId),
  ].filter(Boolean))];
}
