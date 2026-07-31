import { describe, expect, it } from "vitest";
import {
  attendanceFactor,
  calculateAttendanceDayCost,
  resolveOvertimePolicy,
} from "./payroll.js";

describe("cálculo canônico de Ponto e folha", () => {
  it("pondera presença, meio período e falta sem alterar o registro", () => {
    expect(attendanceFactor("P")).toBe(1);
    expect(attendanceFactor("M")).toBe(0.5);
    expect(attendanceFactor("F")).toBe(0);
    const employee = { dailyRate: 120, vtDaily: 12, vrDaily: 18 };
    const result = calculateAttendanceDayCost({ employee, record: { status:"M" } });
    expect(result).toMatchObject({
      basePay: 60,
      benefitCost: 15,
      laborCost: 60,
      totalCost: 75,
    });
    expect(employee).toEqual({ dailyRate: 120, vtDaily: 12, vrDaily: 18 });
  });

  it("monetiza hora extra pela jornada e adicional configurados", () => {
    const result = calculateAttendanceDayCost({
      employee: {
        dailyRate: 100,
        vtDaily: 10,
        vrDaily: 15,
        workdayHours: 8,
        overtimeAdditionalPercent: 50,
      },
      record: { status:"P", ot:2 },
    });
    expect(result.overtimeHourlyRate).toBe(18.75);
    expect(result.overtimePay).toBe(37.5);
    expect(result.laborCost).toBe(137.5);
    expect(result.totalCost).toBe(162.5);
  });

  it("não remunera hora extra sem presença e preserva valores arquivados", () => {
    expect(calculateAttendanceDayCost({
      employee: { dailyRate:999, workdayHours:10, overtimeAdditionalPercent:100 },
      record: {
        status:"P",
        ot:1,
        archivedDailyRate:80,
        archivedWorkdayHours:8,
        archivedOvertimeAdditionalPercent:50,
      },
    }).laborCost).toBe(95);
    expect(calculateAttendanceDayCost({
      employee: { dailyRate:100 },
      record: { status:"F", ot:4 },
    }).overtimePay).toBe(0);
  });

  it("desconta atraso calculado pelos horários sem alterar benefícios", () => {
    const result = calculateAttendanceDayCost({
      employee:{ dailyRate:80, vtDaily:10, vrDaily:10, workdayHours:8, workStart:"07:00" },
      record:{ status:"P", entrada:"07:30", saida:"16:30" },
    });
    expect(result.workedMinutes).toBe(540);
    expect(result.delayMinutes).toBe(30);
    expect(result.delayDeduction).toBe(5);
    expect(result.laborCost).toBe(75);
    expect(result.benefitCost).toBe(20);
  });

  it("aplica política padrão explícita quando o cadastro antigo não possui regra", () => {
    expect(resolveOvertimePolicy()).toEqual({
      workdayHours: 8,
      additionalPercent: 50,
    });
  });

  it("trata dia nulo do legado como ausência de lançamento e custo zero", () => {
    expect(calculateAttendanceDayCost({
      employee: { dailyRate:120, vtDaily:12, vrDaily:18 },
      record: null,
      config: null,
    })).toMatchObject({
      factor: 0,
      basePay: 0,
      overtimePay: 0,
      benefitCost: 0,
      laborCost: 0,
      totalCost: 0,
    });
    expect(resolveOvertimePolicy({ employee:null, record:null, config:null })).toEqual({
      workdayHours: 8,
      additionalPercent: 50,
    });
  });
});
