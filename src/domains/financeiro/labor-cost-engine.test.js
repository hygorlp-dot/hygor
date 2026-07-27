import { describe, expect, it, vi } from "vitest";
import { createLaborCostEngine } from "./labor-cost-engine.js";

const dependencies = overrides => ({
  getPayrollHolidays:() => [],
  isWeekdayIso:() => true,
  isEmployeeEmployedOnDate:() => true,
  getAttendance:(data, employeeId, date) => data.attendance?.[employeeId]?.[date] || null,
  getHolidayPayRule:() => ({ amount:0 }),
  ...overrides,
});

describe("motor financeiro de mão de obra", () => {
  it("separa custo corrente por obra e soma arquivo histórico sem duplicar", () => {
    const engine = createLaborCostEngine(dependencies());
    const data = {
      config:{},
      employees:[
        { id:"e1", obra:"o1", dailyRate:100, vtDaily:10 },
        { id:"e2", obra:"o2", dailyRate:200, vtDaily:20 },
      ],
      attendance:{
        e1:{ "2026-07-01":{ status:"P", obraId:"o1" } },
        e2:{ "2026-07-01":{ status:"P", obraId:"o2" } },
      },
      archivedLaborCosts:{
        q1:{ byDate:{ "2026-07-01":{ o1:{ laborCost:50, benefitCost:5 } } } },
      },
    };

    expect(engine.calculateWorkLaborCost(data, "o1", ["2026-07-01"])).toEqual({
      laborCost:150,
      benefitCost:15,
      totalCost:165,
    });
  });

  it("preserva feriado remunerado e reutiliza o resultado em cache", () => {
    const holidayPay = vi.fn(() => ({ amount:100 }));
    const engine = createLaborCostEngine(dependencies({
      getPayrollHolidays:() => ["2026-07-06"],
      getHolidayPayRule:holidayPay,
    }));
    const data = {
      config:{},
      employees:[{ id:"e1", obra:"o1", dailyRate:100 }],
      attendance:{ e1:{ "2026-07-06":null } },
    };
    const days = ["2026-07-06"];

    const first = engine.calculateWorkLaborCost(data, "o1", days);
    const second = engine.calculateWorkLaborCost(data, "o1", days);

    expect(first).toEqual({ laborCost:100, benefitCost:0, totalCost:100 });
    expect(second).toBe(first);
    expect(holidayPay).toHaveBeenCalledTimes(1);
  });
});
