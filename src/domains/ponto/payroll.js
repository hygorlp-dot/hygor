import { calculateTimekeeping } from "./timekeeping.js";
import { payFactor, workedFactor } from "./attendance-status.js";

const positiveNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const safeRecord = value => value && typeof value === "object" && !Array.isArray(value)
  ? value
  : {};

// Fator de pagamento da diária. Férias/atestado/folga pagam pelo fator de
// afastamento (attendance-status.js); falta e dia sem registro pagam zero.
export const attendanceFactor = (status, config = {}) => payFactor(status, config);

export const hasWaivedDelayDeduction = title =>
  title?.waiveDelayDeduction === true && String(title.status || "").toLowerCase() !== "cancelado";

export function waivedDelayDeductionDates(titles = [], days = []) {
  const periods = titles.filter(hasWaivedDelayDeduction);
  if (!periods.length) return new Set();
  return new Set(days.filter(date => {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    return weekday >= 1 && weekday <= 5 &&
      periods.some(title => date >= title.periodoInicio && date <= title.periodoFim);
  }));
}

export const resolveOvertimePolicy = input => {
  const employee = safeRecord(input?.employee);
  const record = safeRecord(input?.record);
  const config = safeRecord(input?.config);
  const workdayHours = positiveNumber(
    record.archivedWorkdayHours
      ?? employee.workdayHours
      ?? config.payrollWorkdayHours,
    8,
  ) || 8;
  const additionalPercent = positiveNumber(
    record.archivedOvertimeAdditionalPercent
      ?? employee.overtimeAdditionalPercent
      ?? config.payrollOvertimeAdditionalPercent,
    50,
  );
  return { workdayHours, additionalPercent };
};

// Regra única de custo diário do Ponto. A diária remunera a jornada padrão;
// a hora extra é calculada sobre a hora normal acrescida do percentual
// configurado. Falta ou dia sem situação não pode gerar hora extra.
export const calculateAttendanceDayCost = ({
  employee: employeeInput,
  record: recordInput,
  config: configInput,
  waiveDelayDeduction = false,
} = {}) => {
  // Dia sem lançamento é representado por `null` no legado. Defaults de
  // desestruturação só tratam `undefined`, portanto o valor nulo atravessava
  // até `record.status` e derrubava Dashboard/DRE. Registro ausente equivale
  // corretamente a custo zero, nunca a presença presumida.
  const employee = safeRecord(employeeInput);
  const record = safeRecord(recordInput);
  const config = safeRecord(configInput);
  const factor = attendanceFactor(record.status, config);
  // Hora extra e VT/VR só existem em dia trabalhado (P/M), nunca em
  // férias, atestado ou folga.
  const worked = workedFactor(record.status);
  const dailyRate = positiveNumber(record.archivedDailyRate ?? employee.dailyRate);
  const vtDaily = positiveNumber(record.archivedVtDaily ?? employee.vtDaily);
  const vrDaily = positiveNumber(record.archivedVrDaily ?? employee.vrDaily);
  const overtimeHours = worked > 0 ? positiveNumber(record.ot) : 0;
  const { workdayHours, additionalPercent } = resolveOvertimePolicy({
    employee,
    record,
    config,
  });
  const overtimeHourlyRate = workdayHours
    ? (dailyRate / workdayHours) * (1 + additionalPercent / 100)
    : 0;
  const basePay = dailyRate * factor;
  const overtimePay = overtimeHours * overtimeHourlyRate;
  const benefitCost = (vtDaily + vrDaily) * worked;
  const timekeeping = calculateTimekeeping({
    entrada:record.entrada,
    intervaloSaida:record.intervaloSaida,
    intervaloRetorno:record.intervaloRetorno,
    saida:record.saida,
    jornadaInicio:record.archivedWorkStart
      ?? employee.workStart
      ?? config.payrollWorkStart
      ?? "07:00",
  });
  const delayMinutes = worked <= 0 ? 0 : timekeeping.valid && !timekeeping.empty
    ? timekeeping.delayMinutes
    : positiveNumber(record.atrasoMin);
  const delayDeduction = waiveDelayDeduction ? 0 : Math.min(
    basePay,
    workdayHours ? (dailyRate / workdayHours) * (delayMinutes / 60) : 0,
  );
  const laborCost = basePay - delayDeduction + overtimePay;

  return {
    factor,
    worked,
    dailyRate,
    basePay,
    overtimeHours,
    overtimeHourlyRate,
    overtimePay,
    workedMinutes:timekeeping.valid ? timekeeping.workedMinutes : 0,
    delayMinutes,
    delayDeduction,
    benefitCost,
    laborCost,
    totalCost: laborCost + benefitCost,
    workdayHours,
    additionalPercent,
  };
};
