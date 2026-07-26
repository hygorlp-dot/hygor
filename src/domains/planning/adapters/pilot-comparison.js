import { createWorkCalendar, workingDaysBetween } from "../engine/calendars/work-calendar.js";
import { scheduleProject } from "../engine/scheduling/schedule-project.js";
import { adaptLegacyPlanning } from "./legacy-plan.js";

const text = value => String(value || "");
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? text(value) : "";

/**
 * Read-only pilot gate. It does not import, repair or save the legacy plan;
 * it produces the evidence needed to decide whether a project can be migrated
 * from the existing schedule to the parallel scheduling engine.
 */
export function comparePlanningPilot({ data = {}, obraId, calendar = {}, projectStart = "" } = {}) {
  const legacy=adaptLegacyPlanning({ obraId, planos:data.planos, scheduleActivities:data.scheduleActivities, scheduleDependencies:data.scheduleDependencies });
  const warnings=[];
  if (!legacy.activities.length) return { ready:false, source:legacy.source, activities:[], differences:[], warnings:["A obra não possui atividades para o piloto."], errors:[] };
  const normalizedCalendar=createWorkCalendar(calendar);
  const activities=legacy.activities.map(activity => {
    const start=date(activity.startDate); const finish=date(activity.finishDate);
    const duration=Number(activity.duration || 0) || (start && finish ? Math.max(1,workingDaysBetween(start,finish,normalizedCalendar)) : 0);
    if (!start) warnings.push(`Atividade ${activity.id} não possui início planejado.`);
    if (!finish) warnings.push(`Atividade ${activity.id} não possui término planejado.`);
    return { ...activity, startDate:start, finishDate:finish, duration };
  });
  const start=date(projectStart) || activities.map(item => item.startDate).filter(Boolean).sort()[0] || "";
  if (!start) return { ready:false, source:legacy.source, activities, differences:[], warnings, errors:["Informe ao menos uma data de início para comparar o piloto."] };
  const result=scheduleProject({ activities, dependencies:legacy.dependencies, calendars:[normalizedCalendar], projectStart:start });
  const projected=new Map(result.activities.map(item => [item.id,item]));
  const differences=activities.map(source => {
    const target=projected.get(source.id); const fields=[];
    if (!target) fields.push("atividade_ausente");
    else {
      if (source.startDate && source.startDate !== target.startDate) fields.push("inicio");
      if (source.finishDate && source.finishDate !== target.finishDate) fields.push("termino");
      if (Number(source.duration || 0) !== Number(target.duration || 0)) fields.push("duracao");
    }
    return { activityId:source.id, name:source.name, equal:fields.length===0, fields, legacy:{startDate:source.startDate,finishDate:source.finishDate,duration:source.duration}, projected:target ? {startDate:target.startDate,finishDate:target.finishDate,duration:target.duration} : null };
  });
  return { ready:result.errors.length===0, source:legacy.source, projectStart:start, projectFinish:result.projectFinish, activities:result.activities, differences, equal:differences.every(item=>item.equal), warnings:[...new Set([...warnings,...result.warnings])], errors:result.errors };
}
