// Simulação gerencial: o RH compara, para um mês, pagar cada funcionário por
// diária ou como CLT mensal. Não altera cadastro, folha, holerite nem DRE; a
// escolha é guardada só como cenário em employee.payModeSimulations[competência].
import { calculateCltPayslip, money, newCltDraft } from "./clt-payslip.js";
import { calculateLaborProvision, newProvisionDraft } from "./labor-provisions.js";
import { remunerationModeOnDate } from "../rh/remuneration-mode.js";

const n = value => Number(value) || 0;
const filled = value => value !== "" && value != null && Number.isFinite(Number(value)) && Number(value) >= 0;

export const monthEnd = competence => new Date(Date.UTC(Number(competence.slice(0, 4)), Number(competence.slice(5, 7)), 0)).toISOString().slice(0, 10);

// Dias equivalentes no ponto do mês (P = 1, M = 0,5). Serve só de sugestão.
export function attendanceDaysInMonth(attendanceOf, competence) {
  const last = Number(monthEnd(competence).slice(8, 10));
  let days = 0;
  for (let day = 1; day <= last; day++) {
    const status = attendanceOf(`${competence}-${String(day).padStart(2, "0")}`)?.status;
    if (status === "P") days += 1;
    else if (status === "M") days += 0.5;
  }
  return days;
}

export function newPayModeSimulation(employee, competence, { workedDays = "" } = {}) {
  return {
    competence,
    choice: remunerationModeOnDate(employee, monthEnd(competence)) === "clt" ? "clt" : "daily",
    dailyRate: employee?.dailyRate || "",
    workedDays,
    paidHolidays: 0,
    salary: employee?.monthlySalary || employee?.cltPayroll?.profile?.salary || "",
    category: employee?.cltPayroll?.profile?.category || "professional",
    employerChargesPercent: "",
    notes: "",
  };
}

// A diária do app não retém INSS/IRRF nem gera encargos: o custo é o bruto + VT/VR.
function dailyScenario(employee, sim) {
  const errors = [];
  if (!(n(sim.dailyRate) > 0)) errors.push("Informe o valor da diária.");
  if (!filled(sim.workedDays) || n(sim.workedDays) > 31) errors.push("Informe os dias trabalhados no mês (até 31; meio período vale 0,5).");
  if (!filled(sim.paidHolidays)) errors.push("Informe os feriados pagos (zero se não houver).");
  const days = n(sim.workedDays);
  const gross = money(n(sim.dailyRate) * (days + n(sim.paidHolidays)));
  const benefits = money(days * (n(employee?.vtDaily) + n(employee?.vrDaily)));
  return { gross, net: gross, benefits, cost: money(gross + benefits), errors };
}

// CLT: holerite mensal (30 dias, sem eventos), FGTS, provisões e VT/VR.
function cltScenario(employee, sim) {
  const days = Math.min(n(sim.workedDays), 30);
  const draft = {
    ...newCltDraft(sim.competence, { salary: sim.salary, category: sim.category, rules: employee?.cltPayroll?.profile?.rules }),
    workedDays: sim.workedDays === "" ? "" : days,
    transportCost: money(days * n(employee?.vtDaily)),
    transportDays: 30,
    confirmed: true,
  };
  const payslip = calculateCltPayslip(draft);
  const provision = calculateLaborProvision({ ...newProvisionDraft(employee, sim.competence), included: true, base: sim.salary });
  const transportDeduction = payslip.rows.find(row => row.code === "110")?.amount || 0;
  const benefits = money(days * (n(employee?.vtDaily) + n(employee?.vrDaily)) - transportDeduction);
  const charges = filled(sim.employerChargesPercent) ? money(payslip.gross * n(sim.employerChargesPercent) / 100) : null;
  const errors = [...payslip.errors.filter(e => !e.startsWith("Confirme")), ...provision.errors];
  return {
    gross: payslip.gross, net: payslip.net, inss: payslip.inss, irrf: payslip.irrf, fgts: payslip.fgts,
    provisions: provision.monthly ?? 0, benefits, charges,
    cost: money(payslip.gross + payslip.fgts + (provision.monthly ?? 0) + benefits + (charges ?? 0)),
    costComplete: charges !== null,
    errors: [...new Set(errors)],
  };
}

export function simulatePayMode(employee, sim) {
  return { daily: dailyScenario(employee, sim), clt: cltScenario(employee, sim) };
}

export function summarizePayModeSimulation(rows) {
  const chosen = rows.map(({ sim, result }) => ({ choice: sim.choice, scenario: result[sim.choice] }));
  const valid = chosen.filter(row => !row.scenario.errors.length);
  const sum = (list, key) => money(list.reduce((total, row) => total + n(row.scenario[key]), 0));
  const allDaily = rows.filter(r => !r.result.daily.errors.length);
  const allClt = rows.filter(r => !r.result.clt.errors.length);
  return {
    employees: rows.length,
    clt: chosen.filter(row => row.choice === "clt").length,
    daily: chosen.filter(row => row.choice === "daily").length,
    missing: chosen.length - valid.length,
    cost: sum(valid, "cost"),
    net: sum(valid, "net"),
    chargesMissing: valid.filter(row => row.choice === "clt" && !row.scenario.costComplete).length,
    // Referências: toda a equipe numa só modalidade (apenas quem tem cálculo válido nas duas).
    allDailyCost: money(allDaily.filter(r => !r.result.clt.errors.length).reduce((t, r) => t + r.result.daily.cost, 0)),
    allCltCost: money(allClt.filter(r => !r.result.daily.errors.length).reduce((t, r) => t + r.result.clt.cost, 0)),
    comparable: rows.filter(r => !r.result.daily.errors.length && !r.result.clt.errors.length).length,
  };
}
