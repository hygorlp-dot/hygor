import { workingDaysBetween } from "../calendars/work-calendar.js";

const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
const number = value => Number(value ?? 0);
const clamp = value => Math.max(0, Math.min(100, value));
const datesOf = activity => ({ start:date(activity.startDate || activity.inicio), finish:date(activity.finishDate || activity.fim) });

const plannedAt = (activity, asOf, calendar) => {
  const { start, finish }=datesOf(activity);
  if (!start || !finish) return null;
  if (asOf < start) return 0;
  if (asOf >= finish) return 100;
  const total=Math.max(1, workingDaysBetween(start, finish, calendar)-1);
  return clamp((workingDaysBetween(start, asOf, calendar)-1) / total * 100);
};

/**
 * Physical-only Curve S projection. Financial values intentionally do not
 * enter this function; they are joined later by the ledger/EVM projection.
 */
export function buildPhysicalCurve({ activities = [], checkpoints = [], calendar = {}, actualByActivity = {} } = {}) {
  const warnings=[]; const active=activities.filter(item => item?.status !== "cancelled");
  const weighted=active.map(activity => ({ activity, weight:number(activity.physicalWeight) })).filter(item => item.weight > 0);
  if (!weighted.length) return { points:[], totalWeight:0, warnings:["Não há atividades com peso físico para formar a curva."] };
  const totalWeight=weighted.reduce((sum,item) => sum+item.weight,0);
  if (Math.abs(totalWeight-100) > 0.0001) warnings.push("A curva física usa pesos que ainda não totalizam 100%.");
  const points=[...new Set(checkpoints.map(date).filter(Boolean))].sort().map(asOf => {
    let planned=0; let actual=0; let plannedWeight=0; let actualWeight=0;
    weighted.forEach(({ activity, weight }) => {
      const plannedPercent=plannedAt(activity,asOf,calendar);
      if (plannedPercent == null) warnings.push(`Atividade ${activity.id || "sem id"} sem datas válidas foi excluída do planejado.`);
      else { planned+=weight*plannedPercent/100; plannedWeight+=weight; }
      const entry=actualByActivity[String(activity.id)] || {}; const actualPercent=Number(entry.percent);
      if (entry.valid === true && Number.isFinite(actualPercent)) { actual+=weight*clamp(actualPercent)/100; actualWeight+=weight; }
    });
    return {
      date:asOf,
      plannedPercent:plannedWeight ? planned / plannedWeight * 100 : null,
      actualPercent:actualWeight ? actual / actualWeight * 100 : null,
      plannedWeight,
      actualWeight,
    };
  });
  return { points, totalWeight, warnings:[...new Set(warnings)] };
}
