import { expect, it } from "vitest";
import { attendanceDaysInMonth, employerChargesRate, newPayModeSimulation, simulatePayMode, summarizePayModeSimulation } from "./pay-mode-simulation.js";

const employee = { id: "e1", startDate: "2026-01-01", dailyRate: 150, vtDaily: 10, vrDaily: 20, monthlySalary: 3000 };
const sim = overrides => ({ ...newPayModeSimulation(employee, "2026-09"), workedDays: 22, ...overrides });

it("sugere a modalidade vigente no fim do mês e não presume dias trabalhados", () => {
  expect(newPayModeSimulation(employee, "2026-09")).toMatchObject({ choice: "daily", dailyRate: 150, salary: 3000, workedDays: "" });
  expect(newPayModeSimulation({ ...employee, remunerationMode: "clt", remunerationEffectiveFrom: "2026-09-10" }, "2026-09").choice).toBe("clt");
  expect(simulatePayMode(employee, sim({ workedDays: "" })).daily.errors.length).toBeGreaterThan(0);
});

it("diária: bruto pelos dias e feriados, custo com VT/VR e sem encargos", () => {
  const { daily } = simulatePayMode(employee, sim({ paidHolidays: 1 }));
  expect(daily).toMatchObject({ gross: 3450, net: 3450, benefits: 660, cost: 4110, errors: [] });
});

it("CLT: holerite, FGTS, provisões, VT líquido e encargos do Simples Anexo IV por padrão", () => {
  const { clt } = simulatePayMode(employee, sim());
  expect(clt.errors).toEqual([]);
  // Encargos 23% (CPP 20 + RAT 3 × FAP 1) sobre bruto + 13º + férias + 1/3 = 3.583,33
  expect(clt).toMatchObject({ gross: 3000, fgts: 240, provisions: 744.67, chargesRate: 23, chargesBase: 3583.33, charges: 824.17, costComplete: true });
  // VT 220 − desconto 180 (6% de 3000) + VR 440
  expect(clt.benefits).toBe(480);
  expect(clt.cost).toBe(5288.84);
});
it('cenário hipotético mensal não herda o método da reserva real do CLT por diária',()=>{
  const worker={...employee,employmentRelationship:'clt',remunerationMode:'daily',remunerationHistory:[{date:'2026-01-01',mode:'daily'}]},before=structuredClone(worker);
  const result=simulatePayMode(worker,sim()).clt;
  expect(result).toMatchObject({errors:[],provisions:744.67,cost:5288.84});
  expect(worker).toEqual(before);
});

it("calcula a alíquota patronal de cada regime", () => {
  const rate = overrides => employerChargesRate(sim(overrides)).rate;
  expect(rate({ regime: "simples_iv", rat: 3, fap: 1.5 })).toBe(24.5);
  expect(rate({ regime: "simples_das" })).toBe(0);
  expect(rate({ regime: "normal", rat: 3, fap: 1 })).toBe(28.8);
  expect(rate({ regime: "cprb", rat: 3, fap: 1 })).toBe(18.8); // 2026: 10% + 3% + 5,8%
  expect(employerChargesRate(sim({ regime: "cprb", competence: "2028-01" })).rate).toBe(28.8);
  expect(rate({ regime: "manual", employerChargesPercent: 27.5 })).toBe(27.5);
  expect(employerChargesRate(sim({ regime: "manual" })).rate).toBeNull();
  expect(employerChargesRate(sim({ regime: "normal", rat: 4 })).rate).toBeNull();
  expect(simulatePayMode(employee, sim({ regime: "simples_das" })).clt).toMatchObject({ charges: 0, cost: 4464.67 });
  expect(simulatePayMode(employee, sim({ regime: "manual" })).clt).toMatchObject({ charges: null, costComplete: false, cost: 4464.67 });
});

it("CLT exige salário contratual; a diária não é convertida", () => {
  expect(simulatePayMode({ ...employee, monthlySalary: 0 }, sim({ salary: "" })).clt.errors.join(" ")).toMatch(/salário contratual/);
});

it("soma só a modalidade escolhida e marca o total como parcial quando falta dado", () => {
  const rows = [
    { sim: sim({ choice: "daily" }) },
    { sim: sim({ choice: "clt" }) },
    { sim: sim({ choice: "clt", salary: "" }) },
  ].map(row => ({ ...row, result: simulatePayMode(employee, row.sim) }));
  expect(summarizePayModeSimulation(rows)).toMatchObject({ employees: 3, clt: 2, daily: 1, missing: 1, cost: 3960 + 5288.84, chargesMissing: 0, comparable: 2 });
});

it("conta P como 1 e M como meio dia no ponto do mês", () => {
  const att = { "2026-09-01": { status: "P" }, "2026-09-02": { status: "M" }, "2026-09-03": { status: "F" }, "2026-10-01": { status: "P" } };
  expect(attendanceDaysInMonth(date => att[date], "2026-09")).toBe(1.5);
});
it("admissão soma custos iniciais ao mês, sem reduzir líquido ou repetir no mês seguinte",()=>{
  const setup=sim({includeAdmissionCosts:true,admissionCosts:{admissionExam:100,complementaryExams:50,equipmentUniforms:200,initialTraining:80,registrationFees:0,otherAdmissionCosts:20}});
  const normal=simulatePayMode(employee,sim()),result=simulatePayMode(employee,setup);
  expect(result.daily).toMatchObject({admissionCost:450,recurringCost:normal.daily.cost,cost:normal.daily.cost+450,net:normal.daily.net});
  expect(result.clt).toMatchObject({admissionCost:450,cost:normal.clt.cost+450,net:normal.clt.net});
  expect(summarizePayModeSimulation([{sim:setup,result}]).admissionCost).toBe(450);
  expect(newPayModeSimulation(employee,"2026-10").includeAdmissionCosts).toBe(false);
  expect(simulatePayMode(employee,sim({includeAdmissionCosts:true})).daily.errors.join(" ")).toMatch(/use zero/);
});
it("na CPRB 2026 exclui CPP do 13º, preservando RAT e terceiros",()=>{
  const result=simulatePayMode(employee,sim({regime:"cprb"})).clt;
  expect(result.charges).toBe(648.67);
  expect(result.cost).toBe(5113.34);
});
