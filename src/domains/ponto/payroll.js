import { calculateTimekeeping, delayAfterClockTolerance } from "./timekeeping.js";
import {effectiveEmployeeOnDate} from '../rh/remuneration-values.js';

const positiveNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const safeRecord = value => value && typeof value === "object" && !Array.isArray(value)
  ? value
  : {};

export const attendanceFactor = status =>
  status === "P" ? 1 : status === "M" ? 0.5 : 0;

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
  date,
} = {}) => {
  // Dia sem lançamento é representado por `null` no legado. Defaults de
  // desestruturação só tratam `undefined`, portanto o valor nulo atravessava
  // até `record.status` e derrubava Dashboard/DRE. Registro ausente equivale
  // corretamente a custo zero, nunca a presença presumida.
  const employee = safeRecord(date?effectiveEmployeeOnDate(safeRecord(employeeInput),date):employeeInput);
  const record = safeRecord(recordInput);
  const config = safeRecord(configInput);
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
    jornadaFim:record.archivedWorkEnd??employee.workEnd??config.payrollWorkEnd??'',
    intervaloPrevistoSaida:employee.breakStart??config.payrollBreakStart??'',
    intervaloPrevistoRetorno:employee.breakEnd??config.payrollBreakEnd??'',
  });
  const delayMinutes = timekeeping.valid && !timekeeping.empty
    ? timekeeping.delayMinutes
    : positiveNumber(record.atrasoMin);
  // Fotografia restaurada de fechamento mantém o resultado da regra da
  // época. Corrigir tolerância em dias abertos não reapura períodos pagos.
  const archived=record.archivedDailyRate!=null;
  const deductibleDelayMinutes=archived?delayMinutes:
    timekeeping.valid&&!timekeeping.empty?timekeeping.deductibleDelayMinutes:
    delayAfterClockTolerance(delayMinutes).deductibleDelayMinutes;
  const delayDeduction = Math.min(
    basePay,
    workdayHours ? (dailyRate / workdayHours) * (deductibleDelayMinutes / 60) : 0,
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
    deductibleDelayMinutes,
    delayToleranceApplied:!archived&&delayMinutes>0&&deductibleDelayMinutes===0,
    delayReviewRequired:!archived&&Boolean(timekeeping.delayReviewRequired||!(timekeeping.valid&&!timekeeping.empty)&&delayMinutes>0&&delayMinutes<=5),
    delayDeduction,
    benefitCost,
    transportCost:vtDaily*factor,
    mealCost:vrDaily*factor,
    laborCost,
    totalCost: laborCost + benefitCost,
    workdayHours,
    additionalPercent,
  };
};
