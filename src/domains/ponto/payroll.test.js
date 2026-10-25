import { describe, expect, it } from "vitest";
import {
  attendanceFactor,
  calculateAttendanceDayCost,
  resolveOvertimePolicy,
} from "./payroll.js";

describe("cálculo canônico de Ponto e folha", () => {
  it('benefícios individuais usam o valor congelado e compõem o mesmo custo do DRE',()=>{
    const result=calculateAttendanceDayCost({employee:{dailyRate:120,vtDaily:30,vrDaily:40},record:{status:'M',archivedVtDaily:10,archivedVrDaily:20},date:'2026-09-21'});
    expect(result.transportCost).toBe(5);expect(result.mealCost).toBe(10);expect(result.benefitCost).toBe(15);
  });
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

  it.each([1,5])('não desconta atraso de %i minutos dentro da tolerância e preserva a marcação',minutes=>{
    const record={status:'P',entrada:`07:0${minutes}`,saida:'16:00'};
    const result=calculateAttendanceDayCost({employee:{dailyRate:80,workdayHours:8,workStart:'07:00'},record});
    expect(result).toMatchObject({delayMinutes:minutes,deductibleDelayMinutes:0,delayDeduction:0,laborCost:80,delayReviewRequired:true});
    expect(record.entrada).toBe(`07:0${minutes}`);
  });
  it('também aplica tolerância ao atraso numérico legado sem horários',()=>{
    expect(calculateAttendanceDayCost({employee:{dailyRate:80},record:{status:'P',atrasoMin:5}})).toMatchObject({delayMinutes:5,delayDeduction:0,laborCost:80,delayReviewRequired:true});
    expect(calculateAttendanceDayCost({employee:{dailyRate:80},record:{status:'P',atrasoMin:6}})).toMatchObject({delayMinutes:6,delayDeduction:1,laborCost:79});
  });
  it('preserva a regra da fotografia arquivada em vez de recalcular fechamento pago',()=>{
    const result=calculateAttendanceDayCost({employee:{dailyRate:999},record:{status:'P',atrasoMin:5,archivedDailyRate:80,archivedWorkdayHours:8}});
    expect(result).toMatchObject({delayMinutes:5,delayToleranceApplied:false});expect(result.delayDeduction).toBeCloseTo(5/6,10);expect(result.laborCost).toBeCloseTo(80-5/6,10);
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
