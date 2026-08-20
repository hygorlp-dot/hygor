import { describe, expect, it } from "vitest";
import {
  rhComplianceSummary,
  rhHeadcountSummary,
  rhOpenAdvancesSummary,
  rhTurnoverForMonth,
} from "./analytics";

describe("rhHeadcountSummary", () => {
  it("classifica cada funcionário pela mesma régua de employeeLifecycleStatus", () => {
    const employees = [
      { id: "1", active: true, endDate: "" },
      { id: "2", active: false, endDate: "2026-01-10" },
      { id: "3", active: true, endDate: "2027-01-01" },
      { id: "4", status: "arquivado" },
    ];
    expect(rhHeadcountSummary(employees, "2026-08-20")).toEqual({
      ativo: 1, desligamento_agendado: 1, desligado: 1, arquivado: 1, total: 4,
    });
  });
});

describe("rhTurnoverForMonth", () => {
  it("conta admissões e desligamentos cujo mês bate com o informado", () => {
    const employees = [
      { startDate: "2026-08-05", endDate: "" },
      { startDate: "2026-07-01", endDate: "2026-08-15" },
      { startDate: "2026-08-20", endDate: "" },
      { startDate: "2026-01-01", endDate: "2026-02-01" },
    ];
    expect(rhTurnoverForMonth(employees, "2026-08")).toEqual({ admissions: 2, terminations: 1 });
  });

  it("não conta desligamento quando endDate está vazio", () => {
    expect(rhTurnoverForMonth([{ startDate: "2026-01-01", endDate: "" }], "2026-08")).toEqual({ admissions: 0, terminations: 0 });
  });
});

describe("rhOpenAdvancesSummary", () => {
  it("soma só os adiantamentos ativos, ignorando cancelados/estornados", () => {
    const advances = [
      { amount: 500, status: "ativo" },
      { amount: 300, status: "cancelado" },
      { amount: 200 },
    ];
    expect(rhOpenAdvancesSummary(advances)).toEqual({ count: 2, total: 700 });
  });
});

describe("rhComplianceSummary", () => {
  it("conta só funcionários ativos com documento/treinamento vencido", () => {
    const employees = [
      { id: "1", active: true, examExpiresAt: "2026-01-01" },
      { id: "2", active: true, examExpiresAt: "2027-01-01" },
      { id: "3", active: false, endDate: "2026-01-01", examExpiresAt: "2026-01-01" },
    ];
    expect(rhComplianceSummary(employees, "2026-08-20")).toEqual({ activeCount: 2, withExpiredCount: 1 });
  });

  it("conta treinamento NR vencido do mesmo jeito que ASO vencido", () => {
    const employees = [
      { id: "1", active: true, trainings: { nr35: { expiresAt: "2026-01-01" } } },
    ];
    expect(rhComplianceSummary(employees, "2026-08-20")).toEqual({ activeCount: 1, withExpiredCount: 1 });
  });
});
