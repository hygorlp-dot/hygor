import { PROGRESS_METHODS } from "../../models/constants.js";

const number = value => Number(value ?? 0);
const percentage = value => Math.round(number(value) * 10000) / 10000;
const validPercentage = value => Number.isFinite(number(value)) && number(value) >= 0 && number(value) <= 100;
const result = ({ method, percent = 0, valid = true, errors = [], warnings = [], evidence = {} }) => ({
  method,
  percent: percentage(percent),
  valid: valid && errors.length === 0,
  errors,
  warnings,
  // A evidência é somente uma projeção dos dados informados. Nenhuma função
  // deste motor persiste, confirma ou altera medições.
  evidence,
});

/**
 * Calcula avanço físico com uma origem explícita. Percentuais manuais só são
 * aceitos quando marcados como controlados/aprovados; uma tela não pode usar
 * este motor para mascarar um valor digitado como uma medição de campo.
 */
export function calculatePhysicalProgress(input = {}) {
  const method = String(input.method || "");
  if (!PROGRESS_METHODS.includes(method)) return result({ method, valid:false, errors:["Método de progresso físico inválido ou ausente."] });

  if (method === "quantity") {
    const planned = number(input.plannedQuantity); const actual = number(input.actualQuantity);
    if (!(planned > 0)) return result({ method, valid:false, errors:["Quantidade planejada deve ser maior que zero."] });
    if (actual < 0) return result({ method, valid:false, errors:["Quantidade realizada não pode ser negativa."] });
    const raw = actual / planned * 100;
    return result({ method, percent:Math.min(100, raw), warnings:raw > 100 ? ["Quantidade realizada supera a quantidade planejada."] : [], evidence:{ plannedQuantity:planned, actualQuantity:actual } });
  }

  if (method === "physical_weight") {
    const total = number(input.totalWeight); const completed = number(input.completedWeight);
    if (!(total > 0)) return result({ method, valid:false, errors:["Peso físico total deve ser maior que zero."] });
    if (completed < 0) return result({ method, valid:false, errors:["Peso físico concluído não pode ser negativo."] });
    const raw = completed / total * 100;
    return result({ method, percent:Math.min(100, raw), warnings:raw > 100 ? ["Peso físico concluído supera o total previsto."] : [], evidence:{ totalWeight:total, completedWeight:completed } });
  }

  if (method === "milestone") {
    const milestones = Array.isArray(input.milestones) ? input.milestones : [];
    if (!milestones.length) return result({ method, valid:false, errors:["Informe ao menos um marco para medir o avanço."] });
    const total = milestones.reduce((sum, item) => sum + number(item.weight), 0);
    if (Math.abs(total - 100) > 0.0001) return result({ method, valid:false, errors:["Os pesos dos marcos devem totalizar 100%."] });
    return result({ method, percent:milestones.filter(item => item.completed === true || item.status === "completed").reduce((sum, item) => sum + number(item.weight), 0), evidence:{ milestones:milestones.map(item => ({ id:item.id || "", weight:number(item.weight), completed:item.completed === true || item.status === "completed" })) } });
  }

  if (method === "checklist") {
    const items = Array.isArray(input.checklist) ? input.checklist : [];
    if (!items.length) return result({ method, valid:false, errors:["Informe os itens de checklist para medir o avanço."] });
    const total = items.reduce((sum, item) => sum + (item.weight == null ? 1 : number(item.weight)), 0);
    if (!(total > 0)) return result({ method, valid:false, errors:["Os pesos do checklist devem ser maiores que zero."] });
    const completed = items.filter(item => item.completed === true || item.status === "completed").reduce((sum, item) => sum + (item.weight == null ? 1 : number(item.weight)), 0);
    return result({ method, percent:completed / total * 100, evidence:{ checklistCount:items.length, completedCount:items.filter(item => item.completed === true || item.status === "completed").length } });
  }

  const percent = number(input.percent ?? input.manualPercent ?? input.measurementPercent);
  if (!validPercentage(percent)) return result({ method, valid:false, errors:["Percentual físico deve estar entre 0 e 100."] });
  if (method === "approved_measurement" && input.approved !== true) return result({ method, valid:false, errors:["A medição precisa estar aprovada antes de atualizar o progresso."] });
  if (method === "controlled_manual" && input.manualApproved !== true) return result({ method, valid:false, errors:["Percentual manual exige aprovação explícita."] });
  return result({ method, percent, evidence:method === "approved_measurement" ? { measurementId:input.measurementId || "", approved:true } : { approvalId:input.approvalId || "", manualApproved:true } });
}
