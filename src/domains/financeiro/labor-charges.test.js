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
        { id:"clt", obra:"o1", dailyRate:100, vtDaily:10, remunerationMode:"clt", startDate:"2026-01-01" },
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
      employeesSnapshot:[{ id:"clt", obra:"o1", dailyRate:100, remunerationMode:"clt", startDate:"2026-01-01" }],
      attendance:{ clt:{ "2026-07-01":{ status:"P", obraId:"o1" } } },
    };
    expect(summarizeArchivedCosts(archive).byDate["2026-07-01"].o1.laborCost).toBeCloseTo(100 * (1 + cltChargeFactor()), 6);
  });
});
