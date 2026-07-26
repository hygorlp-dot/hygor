import { PHYSICAL_WEIGHT_SOURCES } from "../../models/constants.js";

const number = value => Number(value ?? 0);
const activityId = activity => String(activity?.id || "");

/** Validates the physical weight composition of each WBS work package without mutating it. */
export function validatePhysicalWeights({ activities = [], requireSource = true } = {}) {
  const issues=[]; const groups=new Map();
  activities.filter(activity => activity?.status !== "cancelled").forEach(activity => {
    const id=activityId(activity); const wbsId=String(activity.wbsId || ""); const weight=number(activity.physicalWeight);
    if (!id) { issues.push({ severity:"error", code:"missing_activity_id", message:"Atividade sem identificador não pode receber peso físico." }); return; }
    if (!wbsId) { issues.push({ severity:"error", code:"missing_wbs", activityId:id, message:"Atividade com peso físico exige pacote EAP." }); return; }
    if (!(weight >= 0)) issues.push({ severity:"error", code:"invalid_weight", activityId:id, message:"Peso físico não pode ser negativo." });
    if (requireSource && !PHYSICAL_WEIGHT_SOURCES.includes(activity.physicalWeightSource)) issues.push({ severity:"error", code:"missing_weight_source", activityId:id, message:"Peso físico exige origem declarada." });
    groups.set(wbsId,[...(groups.get(wbsId) || []), { id, weight }]);
  });
  const summaries=[...groups.entries()].map(([wbsId, rows]) => {
    const total=rows.reduce((sum,row) => sum + row.weight, 0); const ok=Math.abs(total-100) < 0.0001;
    if (!ok) issues.push({ severity:"error", code:"weight_total", wbsId, total, message:`Pesos físicos do pacote ${wbsId} devem totalizar 100%.` });
    return { wbsId, total, activityCount:rows.length, ok };
  });
  return { ok:!issues.some(issue => issue.severity === "error"), groups:summaries, issues };
}
