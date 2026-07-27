import { createDreCalculations } from "../dre/calculations.js";
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

  return {
    calcObraLaborCost:calculateWorkLaborCost,
    calcEquipCustoObra,
    calcEquipFaturamentoEmpresa,
    ...dre,
  };
};
