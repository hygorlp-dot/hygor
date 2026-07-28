import { describe, expect, it, vi } from "vitest";
import { createMonthlyFinancialReportEngine } from "./monthly-report.js";

describe("relatório financeiro mensal", () => {
  it("usa valores canônicos e deixa coleções operacionais somente nos detalhes", () => {
    const calculateWorkDre = vi.fn(() => ({
      ledger:{ events:[] },
      moData:{ laborCost:200, benefitCost:20 },
      tercCost:150,
      rescTotal:40,
      entradasCaixa:900,
      totalCustos:600,
      lucroBruto:400,
      margemBruta:40,
    }));
    const selectMovements = vi.fn(() => [{
      id:"cash-1",
      natureza:"cash_in",
      data:"2026-07-02",
      valor:900,
      descricao:"Recebimento",
      origem:"medicao",
    }]);
    const engine = createMonthlyFinancialReportEngine({
      getDays:() => ["2026-07-01", "2026-07-02"],
      calculateWorkDre,
      calculateWorkContractProjection:() => ({ revenue:1200 }),
      getAttendanceStatus:(_data, employeeId, date) =>
        employeeId === "e1" && date === "2026-07-01" ? "P" : "F",
      selectMovements,
    });
    const result = engine.calculateMonthlyFinancialReport({
      obras:[{ id:"o1", name:"Obra 1" }],
      employees:[{ id:"e1", obra:"o1", active:true }],
      terceirizados:[{ id:"t1", obraId:"o1", active:true }],
      pagsTerceiros:[
        { id:"pt1", obraId:"o1", pagador:"obra", date:"2026-07-03", valor:150 },
        { id:"pt2", obraId:"o1", pagador:"empresa", date:"2026-07-03", valor:999 },
      ],
      rescisoes:[{ id:"r1", obraName:"Obra 1", demissao:"2026-07-15" }],
      advances:[{ id:"a1", empId:"e1", date:"2026-07-05", amount:50 }],
    }, 2026, 6);

    expect(calculateWorkDre).toHaveBeenCalledWith(expect.any(Object), "o1", 2026, 6, "mes");
    expect(selectMovements).toHaveBeenCalledWith(expect.any(Object), {
      obraId:"o1",
      startDate:"2026-07-01",
      endDate:"2026-07-02",
    });
    expect(result[0]).toMatchObject({
      tercCost:150,
      rescTotal:40,
      adiantTotal:50,
      received:900,
      revenueEsperada:1200,
      totalDespesas:600,
      margem:400,
      margemEsperada:600,
      margemPct:40,
      activeEmps:1,
      activeTercs:1,
      presencaDias:1,
      faltas:1,
    });
    expect(result[0].tercDetalhes.map(item => item.id)).toEqual(["pt1"]);
    expect(result[0].recDetalhes[0]).toMatchObject({ id:"cash-1", amount:900 });
  });

  it("falha cedo quando uma dependência de domínio não foi conectada", () => {
    expect(() => createMonthlyFinancialReportEngine()).toThrow("calendário");
  });
});
