import { describe, expect, it } from "vitest";
import { buildRequestedDreProjectionRows } from "./dre-projection.js";

// Regressão: server/dre-projection.js reimplementava o cálculo de mão de obra
// do zero (função `laborCost` local) e ignorava `employee.obraHistory` /
// `data.changeLog`, atribuindo o custo do funcionário sempre à obra atual —
// mesmo em datas anteriores a uma transferência. O DRE do servidor divergia
// do motor canônico do cliente (src/domains/financeiro/labor-cost-engine.js),
// que já respeitava o histórico. Corrigido reusando o mesmo motor no servidor.
describe("DRE do servidor — mão de obra após transferência de obra", () => {
  it("atribui o custo à obra correta antes e depois da transferência do funcionário", () => {
    const data = {
      config: {},
      obras: [
        { id: "o1", name: "Obra antiga" },
        { id: "o2", name: "Obra nova" },
      ],
      employees: [{
        id: "e1", obra: "o2", dailyRate: 100,
        obraHistory: [{ date: "2026-07-15", fromObraId: "o1", toObraId: "o2" }],
      }],
      attendance: { e1: {
        "2026-07-10": { status: "P" },
        "2026-07-20": { status: "P" },
      } },
    };

    const [oldWorkRow] = buildRequestedDreProjectionRows(data, [
      { year: 2026, month: 6, period: "mes", scope: "o1" },
    ]);
    const [newWorkRow] = buildRequestedDreProjectionRows(data, [
      { year: 2026, month: 6, period: "mes", scope: "o2" },
    ]);

    // Antes da transferência (10/07): custo pertence à obra antiga.
    expect(oldWorkRow.payload.moData.laborCost).toBe(100);
    // Depois da transferência (20/07): custo pertence à obra nova.
    expect(newWorkRow.payload.moData.laborCost).toBe(100);
  });
});
