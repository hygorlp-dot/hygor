import { calculateTimekeeping } from "./timekeeping.js";

const positiveNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

export const attendanceFactor = status =>
  status === "P" ? 1 : status === "M" ? 0.5 : 0;

export const resolveOvertimePolicy = ({ employee = {}, record = {}, config = {} } = {}) => {
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
  employee = {},
  record = {},
  config = {},
} = {}) => {
  const factor = attendanceFactor(record.status);
  const dailyRate = positiveNumber(record.archivedDailyRate ?? employee.dailyRate);
  const vtDaily = positiveNumber(record.archivedVtDaily ?? employee.vtDaily);
  const vrDaily = positiveNumber(record.archivedVrDaily ?? employee.vrDaily);
  const overtimeHours = factor > 0 ? positiveNumber(record.ot) : 0;
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
  const benefitCost = (vtDaily + vrDaily) * factor;
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
  const delayMinutes = timekeeping.valid && !timekeeping.empty
    ? timekeeping.delayMinutes
    : positiveNumber(record.atrasoMin);
  const delayDeduction = Math.min(
    basePay,
    workdayHours ? (dailyRate / workdayHours) * (delayMinutes / 60) : 0,
  );
  const laborCost = basePay - delayDeduction + overtimePay;

  return {
    factor,
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
