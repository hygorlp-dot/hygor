// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { monthName } from "../../legacy/format.js";
import { createFinancialCalculationEngine } from "./calculation-engine";
import { getDays } from "../ponto/attendance-engine";
import { getQ } from "../ponto/attendance-engine";
import { getPayrollHolidays } from "../ponto/attendance-engine";
import { prIsWeekdayIso } from "../ponto/attendance-engine";
import { isEmployeeEmployedOnDate } from "../ponto/attendance-engine";
import { getAtt } from "../ponto/attendance-engine";
import { attStatus } from "../ponto/attendance-engine";
import { getHolidayPayRule } from "../ponto/attendance-engine";


//
// Dashboard
//

//
// HELPERS FINANCEIROS
//

export const {
  calcObraLaborCost,
  calcDREObra,
  calcDREConsolidado,
  calcDREHistorico,
  calcVisaoFinanceira,
  calcLedgerAcumulado,
  calcProjecaoContratoObra,
  calculateFinancialRanking:calcularRankingFinanceiro,
  calculateMonthlyFinancialReport:calcRelatorioMensal,
} = createFinancialCalculationEngine({
  getDays,
  getQ,
  monthName,
  getPayrollHolidays,
  isWeekdayIso:prIsWeekdayIso,
  isEmployeeEmployedOnDate,
  getAttendance:getAtt,
  getAttendanceStatus:attStatus,
  getHolidayPayRule,
});
