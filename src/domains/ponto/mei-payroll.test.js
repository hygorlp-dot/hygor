import { expect, it } from "vitest";
import { meiFortnightAllocation } from "./mei-payroll.js";

const cycle = (start, count) => Array.from({ length: count }, (_, index) => {
  const date = new Date(`${start}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
});
const mei = overrides => ({ id: "m", startDate: "2026-01-01", remunerationMode: "mei", meiMonthlyValue: 3000, ...overrides });

it("paga metade do valor mensal na quinzena inteira, numa obra", () => {
  const result = meiFortnightAllocation({ employee: mei(), cycleDays: cycle("2026-10-21", 16), obraOf: () => "o1" });
  expect(result).toEqual({ total: 1500, days: 16, byObra: [{ obraId: "o1", days: 16, amount: 1500 }] });
});

it("proporcionaliza entrada no meio do ciclo pelos dias de calendário", () => {
  const employee = mei({ startDate: "2026-10-29" });
  const result = meiFortnightAllocation({ employee, cycleDays: cycle("2026-10-21", 16), isEmployed: (e, date) => date >= e.startDate });
  // 29/10 a 05/11 = 8 de 16 dias.
  expect(result).toMatchObject({ total: 750, days: 8 });
});

it("divide entre obras pelos dias de lotação e fecha no centavo", () => {
  const result = meiFortnightAllocation({ employee: mei({ meiMonthlyValue: 1000 }), cycleDays: cycle("2026-10-06", 15),
    obraOf: (e, date) => date < "2026-10-11" ? "o1" : "o2" });
  expect(result.total).toBe(500);
  expect(result.byObra).toEqual([{ obraId: "o1", days: 5, amount: 166.67 }, { obraId: "o2", days: 10, amount: 333.33 }]);
  expect(result.byObra.reduce((sum, item) => sum + Math.round(item.amount * 100), 0)).toBe(50000);
});

it("não paga quem não está em MEI nos dias do ciclo nem sem valor cadastrado", () => {
  expect(meiFortnightAllocation({ employee: mei({ remunerationMode: "daily" }), cycleDays: cycle("2026-10-06", 15) }).total).toBe(0);
  expect(meiFortnightAllocation({ employee: mei({ meiMonthlyValue: 0 }), cycleDays: cycle("2026-10-06", 15) }).total).toBe(0);
  const switched = mei({ remunerationHistory: [{ date: "2026-01-01", mode: "daily" }, { date: "2026-10-16", mode: "mei" }] });
  expect(meiFortnightAllocation({ employee: switched, cycleDays: cycle("2026-10-06", 15) })).toMatchObject({ total: 500, days: 5 });
});
