import { active } from "../financeiro/ledger.js";

const cents = value => Math.round(Number(value || 0));

export const projectCashflow = (items = [], { openingBalanceCents = 0, scenario = "confirmado" } = {}) => {
  let balance = cents(openingBalanceCents);
  const lines = items
    .filter(item => (item.scenario || "confirmado") === scenario || item.scenario === "confirmado")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(item => {
      const amount = cents(item.amountCents);
      balance += item.direction === "entrada" ? amount : -amount;
      return { ...item, amountCents:amount, projectedBalanceCents:balance };
    });
  const minimumBalanceCents = Math.min(cents(openingBalanceCents), ...lines.map(item => item.projectedBalanceCents));
  return {
    openingBalanceCents:cents(openingBalanceCents), lines,
    closingBalanceCents:balance, minimumBalanceCents,
    capitalNeedCents:Math.max(0, -minimumBalanceCents),
  };
};

export const contractBalances = (contract = {}, measurements = [], receipts = []) => {
  const originalCents = cents(contract.valueCents ?? Number(contract.valor || 0) * 100);
  const billedCents = measurements
    .filter(item => item.contractId === contract.id && active(item))
    .reduce((sum, item) => sum + cents(item.valueCents ?? Number(item.valorPrevisto || 0) * 100), 0);
  const receivedCents = receipts
    .filter(item => item.contractId === contract.id && active(item))
    .reduce((sum, item) => sum + cents(item.amountCents ?? Number(item.valor || 0) * 100), 0);
  return {
    originalCents, billedCents, receivedCents,
    openReceivableCents:billedCents - receivedCents,
    unbilledCents:originalCents - billedCents,
  };
};
