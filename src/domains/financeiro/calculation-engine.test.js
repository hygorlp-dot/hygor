import { describe, expect, it } from "vitest";
import { createFinancialCalculationEngine } from "./calculation-engine.js";

describe("fachada dos motores financeiros", () => {
  it("projeta o custo do ponto no mesmo DRE canônico", () => {
    const day = "2026-07-01";
    const engine = createFinancialCalculationEngine({
      getDays:() => [day],
      getQ:() => ({ q1:[day], q2:[] }),
      monthName:() => "Jul",
      getPayrollHolidays:() => [],
      isWeekdayIso:() => true,
      isEmployeeEmployedOnDate:() => true,
      getAttendance:(data, employeeId, date) =>
        data.attendance?.[employeeId]?.[date] || null,
      getHolidayPayRule:() => ({ amount:0 }),
    });
    const data = {
      config:{},
      obras:[{ id:"o1", name:"Obra 1", contractValue:1000 }],
      employees:[{ id:"e1", obra:"o1", dailyRate:100 }],
      attendance:{ e1:{ [day]:{ status:"P", obraId:"o1" } } },
      equipamentos:[],
      locacoesEquip:[],
      manutencoesEquip:[],
    };

    expect(engine.calcObraLaborCost(data, "o1", [day])).toMatchObject({
      laborCost:100,
      totalCost:100,
    });
    expect(engine.calcDREObra(data, "o1", 2026, 6)).toMatchObject({
      totalCustos:100,
      lucroBruto:-100,
      moData:{ laborCost:100 },
    });
  });
});
