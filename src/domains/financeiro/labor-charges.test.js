import { describe, expect, it } from "vitest";
import { cltChargeFactor, laborChargeFactor, laborChargesConfig } from "./labor-charges.js";
import { createLaborCostEngine } from "./labor-cost-engine.js";
import { summarizeArchivedCosts } from "../../../server/archived-costs.js";

const engine = createLaborCostEngine({
  getPayrollHolidays:() => [], isWeekdayIso:() => true, isEmployeeEmployedOnDate:() => true,
  getAttendance:(data, employeeId, date) => data.attendance?.[employeeId]?.[date] || null,
  getHolidayPayRule:() => ({ amount:0 }),
});

describe("encargos e provisões da mão de obra", () => {
  it("Simples Anexo IV com padrões: ~60,3% sobre a remuneração CLT", () => {
    // (1 + 19,44%) × (20% + 3% × 1,0 + 8% × 1,4) + 19,44%
    expect(cltChargeFactor()).toBeCloseTo(0.60294, 4);
    expect(laborChargeFactor("daily")).toBe(0);
  });

  it("respeita a configuração da empresa e ignora valores inválidos", () => {
    const config = { laborCharges:{ ratPercent:2, fap:0.5, multaFgtsPercent:0, provisionar13Ferias:false, diaristaPercent:20 } };
    // 20% + 2% × 0,5 + 8%
    expect(cltChargeFactor(config)).toBeCloseTo(0.29, 6);
    expect(laborChargeFactor("daily", config)).toBe(0.2);
    expect(laborChargesConfig({ laborCharges:{ fap:9, multaFgtsPercent:33, fgtsPercent:-1 } }))
      .toMatchObject({ fap:1, multaFgtsPercent:40, fgtsPercent:8 });
  });

  it("o DRE soma encargos só ao CLT, sem encargo sobre VT/VR", () => {
    const data = {
      config:{},
      employees:[
        { id:"clt", obra:"o1", dailyRate:100, vtDaily:10, remunerationMode:"clt", startDate:"2026-01-01", monthlySalary:0 },
        { id:"dia", obra:"o1", dailyRate:100, vtDaily:10 },
      ],
      attendance:{
        clt:{ "2026-07-01":{ status:"P", obraId:"o1" } },
        dia:{ "2026-07-01":{ status:"P", obraId:"o1" } },
      },
    };
    const cost = engine.calculateWorkLaborCost(data, "o1", ["2026-07-01"]);
    expect(cost.laborCost).toBeCloseTo(200 + 100 * cltChargeFactor(), 6);
    expect(cost.chargesCost).toBeCloseTo(100 * cltChargeFactor(), 6);
    expect(cost.benefitCost).toBe(20);
  });

  it("a quinzena arquivada recebe o mesmo encargo que a aberta", () => {
    const archive = {
      employeesSnapshot:[{ id:"clt", obra:"o1", dailyRate:100, remunerationMode:"clt", startDate:"2026-01-01" }], // sem salário: vale a diária
      attendance:{ clt:{ "2026-07-01":{ status:"P", obraId:"o1" } } },
    };
    expect(summarizeArchivedCosts(archive).byDate["2026-07-01"].o1.laborCost).toBeCloseTo(100 * (1 + cltChargeFactor()), 6);
  });
});

describe("CLT custeado pelo salário mensal", () => {
  const weekdayEngine = createLaborCostEngine({
    getPayrollHolidays:() => ["2026-07-15"], isWeekdayIso:date => { const d = new Date(date + "T12:00:00Z").getUTCDay(); return d > 0 && d < 6; },
    isEmployeeEmployedOnDate:() => true,
    getAttendance:(data, employeeId, date) => data.attendance?.[employeeId]?.[date] || null,
    getHolidayPayRule:() => ({ amount:999 }),
  });
  const julho = Array.from({ length:31 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
  const base = {
    config:{ laborCharges:{ provisionar13Ferias:false, inssPatronalPercent:0, ratPercent:0, fgtsPercent:0 } },
    obras:[{ id:"o1" }, { id:"o2" }],
    employees:[{ id:"c", obra:"o1", dailyRate:0, monthlySalary:2300, remunerationMode:"clt", startDate:"2026-01-01" }],
    attendance:{ c:{ "2026-07-01":{ status:"P", obraId:"o2" }, "2026-07-02":{ status:"F", obraId:"o2" } } },
  };
  it("o mês fecha no salário, sem pagar feriado em dobro, rateado pelas obras do ponto", () => {
    const o1 = weekdayEngine.calculateWorkLaborCost(base, "o1", julho).laborCost;
    const o2 = weekdayEngine.calculateWorkLaborCost(base, "o2", julho).laborCost;
    expect(o1 + o2).toBeCloseTo(2300, 6);       // julho/2026: 23 dias úteis
    // 2 dias apontados na o2 + o feriado de 15/07, que vai para a obra do
    // último dia trabalhado antes dele (regra já existente do feriado).
    expect(o2).toBeCloseTo(3 * 2300 / 23, 6);
  });
  it("encargos incidem sobre o salário", () => {
    const comEncargo = { ...base, config:{} };
    const total = ["o1", "o2"].reduce((s, o) => s + weekdayEngine.calculateWorkLaborCost(comEncargo, o, julho).laborCost, 0);
    expect(total).toBeCloseTo(2300 * (1 + cltChargeFactor()), 4);
  });
  it("arquivo da quinzena não conta de novo o CLT com salário", () => {
    const archive = { employeesSnapshot:[base.employees[0]], attendance:{ c:{ "2026-07-01":{ status:"P", obraId:"o2" } } } };
    expect(summarizeArchivedCosts(archive).byDate).toEqual({});
  });
});
