import { createDreCalculations } from "../dre/calculations.js";
import { createFinancialRankingEngine } from "../controladoria/financial-ranking.js";
import { createMonthlyFinancialReportEngine } from "../controladoria/monthly-report.js";
import {
  calcEquipCustoObra,
  calcEquipFaturamentoEmpresa,
} from "../equipamentos/calculations.js";
import { createLaborCostEngine } from "./labor-cost-engine.js";

// Fachada de aplicação: o LegacyApp fornece calendário e ponto; consumidores
// recebem uma única família de cálculos financeiros, todos ligados ao mesmo
// ledger/DRE canônico.
export const createFinancialCalculationEngine = ({
  getDays,
  getQ,
  monthName,
  getAttendanceStatus,
  ...laborDependencies
} = {}) => {
  const { calculateWorkLaborCost } = createLaborCostEngine(laborDependencies);
  const dre = createDreCalculations({
    getDays,
    getQ,
    monthName,
    calcObraLaborCost:calculateWorkLaborCost,
    calcEquipCustoObra,
    calcEquipFaturamentoEmpresa,
  });
  const ranking = createFinancialRankingEngine({
    calculateWorkDre:dre.calcDREObra,
  });
  const reports = createMonthlyFinancialReportEngine({
    getDays,
    calculateWorkDre:dre.calcDREObra,
    calculateWorkContractProjection:dre.calcProjecaoContratoObra,
    getAttendanceStatus,
  });

  return {
    calcObraLaborCost:calculateWorkLaborCost,
    calcEquipCustoObra,
    calcEquipFaturamentoEmpresa,
    ...dre,
    ...ranking,
    ...reports,
  };
};
