import { describe, expect, it } from "vitest";
import { isValidAttendanceStatus, leavePayFactor, payFactor, workedFactor } from "./attendance-status.js";
import { calculateAttendanceDayCost } from "./payroll.js";

const employee = { id:"e1", dailyRate:200, vtDaily:10, vrDaily:20 };

describe("férias, atestado e folga no ponto", () => {
  it("são situações válidas e não contam como dia trabalhado", () => {
    ["P","M","F","FE","AT","FG"].forEach(status => expect(isValidAttendanceStatus(status)).toBe(true));
    expect(isValidAttendanceStatus("X")).toBe(false);
    expect(workedFactor("FE")).toBe(0);
  });

  it("pagam pelo fator padrão (férias e atestado pagam, folga não) ou pelo configurado", () => {
    expect(payFactor("FE")).toBe(1);
    expect(payFactor("AT")).toBe(1);
    expect(payFactor("FG")).toBe(0);
    expect(leavePayFactor("FG", { attendanceLeavePayFactors:{ FG:1 } })).toBe(1);
    expect(leavePayFactor("FE", { attendanceLeavePayFactors:{ FE:7 } })).toBe(1);
  });

  it("férias pagam a diária sem VT/VR, sem hora extra e sem desconto de atraso", () => {
    const cost = calculateAttendanceDayCost({ employee, record:{ status:"FE", ot:3, atrasoMin:60 } });
    expect(cost).toMatchObject({ basePay:200, overtimePay:0, delayDeduction:0, benefitCost:0, laborCost:200 });
    expect(calculateAttendanceDayCost({ employee, record:{ status:"F" } }).laborCost).toBe(0);
    expect(calculateAttendanceDayCost({ employee, record:{ status:"P" } }).benefitCost).toBe(30);
  });
});
