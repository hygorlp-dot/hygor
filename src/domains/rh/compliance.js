import { overdue } from "../seguranca/calculations";
import { WORKER_TRAINING_TYPES } from "../seguranca/constants";

// Lista, para um funcionário, quais documentos/certificações estão
// vencidos na data informada (ASO + NRs cadastradas em Equipe). Compartilhado
// entre EquipeView (alerta por funcionário) e o painel de indicadores do RH
// (contagem agregada) para não ter duas implementações da mesma regra de
// vencimento - ambas precisam concordar sempre.
export const employeeComplianceStatus = (employee = {}, asOf = "") => {
  const expired = [];
  if (overdue(employee.examExpiresAt, asOf)) expired.push("Exame ocupacional (ASO)");
  WORKER_TRAINING_TYPES.forEach(t => {
    if (overdue(employee.trainings?.[t.key]?.expiresAt, asOf)) expired.push(t.label);
  });
  return { expired };
};
