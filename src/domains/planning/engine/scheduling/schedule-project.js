import { DEPENDENCY_TYPES } from "../../models/constants.js";
import { addWorkingDays, nextWorkingDate } from "../calendars/work-calendar.js";

const text = value => String(value || "");
const durationOf = activity => Math.max(0, Math.round(Number(activity.duration ?? activity.durationDays ?? 0)));
const compare = (left, right) => String(left).localeCompare(String(right));
const later = (...values) => values.filter(Boolean).sort(compare).at(-1) || "";
const predecessorStart = (link, predecessor, activity, calendar) => {
  const lag = Number(link.lag ?? link.lagDays ?? 0); const duration = durationOf(activity);
  if (link.type === "FS") return addWorkingDays(predecessor.finishDate, 1 + lag, calendar);
  if (link.type === "SS") return addWorkingDays(predecessor.startDate, lag, calendar);
  if (link.type === "FF") return addWorkingDays(predecessor.finishDate, lag - Math.max(0, duration - 1), calendar);
  return addWorkingDays(predecessor.startDate, lag - Math.max(0, duration - 1), calendar);
};
const finishFor = (start, duration, calendar) => addWorkingDays(start, Math.max(0, duration - 1), calendar);

export function topologicalActivityOrder(activities = [], dependencies = []) {
  const ids = new Set(activities.map(activity => text(activity.id)));
  const indegree = new Map([...ids].map(id => [id, 0])); const next = new Map([...ids].map(id => [id, []]));
  for (const raw of dependencies) { const fromId=text(raw.fromId || raw.predecessorId); const toId=text(raw.toId || raw.successorId); const type=String(raw.type || "FS").toUpperCase();
    if (!ids.has(fromId) || !ids.has(toId)) throw new Error("Dependência aponta para atividade inexistente.");
    if (fromId === toId || !DEPENDENCY_TYPES.includes(type)) throw new Error("Dependência de planejamento inválida.");
    indegree.set(toId, indegree.get(toId)+1); next.get(fromId).push({ ...raw, fromId, toId, type });
  }
  const queue=[...ids].filter(id => indegree.get(id)===0).sort(); const order=[];
  while(queue.length){ const id=queue.shift(); order.push(id); for(const link of next.get(id)){ indegree.set(link.toId,indegree.get(link.toId)-1); if(indegree.get(link.toId)===0) queue.push(link.toId); } queue.sort(); }
  if(order.length!==ids.size) throw new Error("Cronograma possui dependência cíclica.");
  return { order, next };
}

/** Motor puro: aplica datas úteis, dependências e restrições de início sem mutar atividades. */
export function scheduleProject({ activities = [], dependencies = [], calendars = [], constraints = [], projectStart } = {}) {
  const warnings=[]; const errors=[]; const byId=new Map(activities.map(activity => [text(activity.id), { ...activity, id:text(activity.id) }]));
  const inferredProjectStart=text(projectStart) || activities.map(activity => text(activity.startDate || activity.inicio)).filter(Boolean).sort(compare)[0] || "";
  if (activities.length && !inferredProjectStart) return { activities:[], projectStart:"", projectFinish:"", warnings, errors:["Informe a data de início do projeto ou de uma atividade."] };
  let graph; try { graph=topologicalActivityOrder(activities,dependencies); } catch (error) { return { activities:[], projectStart:"", projectFinish:"", warnings, errors:[error.message] }; }
  const calendarById=new Map((calendars || []).map(calendar => [text(calendar.id), calendar])); const scheduled=new Map();
  for(const id of graph.order){ const activity=byId.get(id); const calendar=calendarById.get(text(activity.calendarId)) || calendars[0] || {}; const incoming=dependencies.filter(link => text(link.toId || link.successorId)===id);
    const starts=incoming.map(link => predecessorStart({ ...link, type:link.type || "FS" },scheduled.get(text(link.fromId || link.predecessorId)),activity,calendar));
    const restriction=constraints.find(item => text(item.activityId)===id && ["start_on","start_no_earlier_than","start_after"].includes(item.type));
    const requested=activity.startDate || activity.inicio || inferredProjectStart;
    const constrained=restriction?.date || restriction?.dateValue || "";
    const start=nextWorkingDate(later(requested, constrained, ...starts), calendar); const finish=finishFor(start,durationOf(activity),calendar);
    if(activity.status === "cancelled") warnings.push(`Atividade cancelada mantida fora do cálculo de produção: ${id}.`);
    scheduled.set(id,{ ...activity, startDate:start, finishDate:finish, duration:durationOf(activity), calendarId:activity.calendarId || calendars[0]?.id || "default" });
  }
  const values=graph.order.map(id => scheduled.get(id));
  (constraints || []).forEach(constraint => {
    const activity=scheduled.get(text(constraint.activityId)); const limit=text(constraint.date || constraint.dateValue); const type=text(constraint.type);
    if (!activity || !limit) return;
    if ((type === "start_no_later_than" || type === "start_on") && activity.startDate > limit) errors.push(`Atividade ${activity.id} viola a restrição de início ${type}.`);
    if (type === "start_on" && activity.startDate !== limit) errors.push(`Atividade ${activity.id} não inicia na data obrigatória.`);
    if ((type === "finish_no_later_than" || type === "finish_on") && activity.finishDate > limit) errors.push(`Atividade ${activity.id} viola a restrição de término ${type}.`);
    if (type === "finish_on" && activity.finishDate !== limit) errors.push(`Atividade ${activity.id} não termina na data obrigatória.`);
  });
  const projectStartDate=values.map(item=>item.startDate).sort(compare)[0] || ""; const projectFinish=values.map(item=>item.finishDate).sort(compare).at(-1) || "";
  return { activities:values, projectStart:projectStartDate, projectFinish, warnings, errors };
}
