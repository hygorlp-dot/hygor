// MEI (decisão do dono, 29/10/2026): valor fixo mensal, pago metade em cada
// quinzena da folha, sem ponto, encargos ou benefícios. Entrada ou saída no
// meio do ciclo paga proporcionalmente aos dias de calendário com contrato
// MEI. A obra de cada dia é a lotação (com transferências), pois não há ponto.
import { remunerationModeOnDate } from "../rh/remuneration-mode.js";

const cents = value => Math.round((Number(value) + Number.EPSILON) * 100);

export function meiFortnightAllocation({ employee, cycleDays = [], isEmployed = () => true, obraOf = () => "" } = {}) {
  const monthly = Number(employee?.meiMonthlyValue || 0);
  const contractDays = cycleDays.filter(date => isEmployed(employee, date) && remunerationModeOnDate(employee, date) === "mei");
  if (!(monthly > 0) || !contractDays.length || !cycleDays.length) return { total: 0, days: contractDays.length, byObra: [] };
  const totalCents = cents(monthly / 2 * contractDays.length / cycleDays.length);
  const daysByObra = new Map();
  for (const date of contractDays) {
    const obraId = String(obraOf(employee, date) || "");
    daysByObra.set(obraId, (daysByObra.get(obraId) || 0) + 1);
  }
  // Maiores restos: as parcelas por obra somam exatamente o total em centavos.
  const shares = [...daysByObra].map(([obraId, days]) => {
    const exact = totalCents * days / contractDays.length;
    return { obraId, days, amountCents: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let missing = totalCents - shares.reduce((sum, share) => sum + share.amountCents, 0);
  for (const share of [...shares].sort((a, b) => b.rest - a.rest || a.obraId.localeCompare(b.obraId))) {
    if (missing <= 0) break;
    share.amountCents += 1; missing -= 1;
  }
  return {
    total: totalCents / 100,
    days: contractDays.length,
    byObra: shares.map(({ obraId, days, amountCents }) => ({ obraId, days, amount: amountCents / 100 })),
  };
}
