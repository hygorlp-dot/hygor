import { topologicalActivityOrder } from "../scheduling/schedule-project.js";

const durationOf = activity => Math.max(0, Number(activity.duration ?? activity.durationDays ?? 0));
const linkOf = link => ({ ...link, fromId:String(link.fromId || link.predecessorId), toId:String(link.toId || link.successorId), type:link.type || "FS", lag:Number(link.lag ?? link.lagDays ?? 0) });
const forwardStart = (link, predecessor, current) => {
  if (link.type === "FS") return predecessor.earlyFinish + link.lag;
  if (link.type === "SS") return predecessor.earlyStart + link.lag;
  if (link.type === "FF") return predecessor.earlyFinish + link.lag - current.duration;
  return predecessor.earlyStart + link.lag - current.duration;
};
const latestBound = (link, successor, current) => {
  if (link.type === "FS") return { finish:successor.lateStart - link.lag };
  if (link.type === "SS") return { start:successor.lateStart - link.lag };
  if (link.type === "FF") return { finish:successor.lateFinish - link.lag };
  return { start:successor.lateFinish - link.lag };
};

/** CPM independente da interface. Datas de calendário são aplicadas pelo agendador; esta função calcula a rede e suas folgas. */
export function calculateCriticalPath({ activities = [], dependencies = [], projectStartDay = 0 } = {}) {
  let graph; try { graph=topologicalActivityOrder(activities, dependencies); } catch (error) { return { activities:[], criticalPath:[], nearCriticalPath:[], projectDuration:0, errors:[error.message] }; }
  const incoming=new Map(graph.order.map(id=>[id,[]])); const outgoing=new Map(graph.order.map(id=>[id,[]])); const links=dependencies.map(linkOf);
  links.forEach(link=>{incoming.get(link.toId).push(link);outgoing.get(link.fromId).push(link);});
  const values=new Map(activities.map(item=>[String(item.id),{...item,id:String(item.id),duration:durationOf(item)}]));
  graph.order.forEach(id=>{ const current=values.get(id); const earlyStart=Math.max(Number(projectStartDay || 0),...incoming.get(id).map(link=>forwardStart(link,values.get(link.fromId),current))); values.set(id,{...current,earlyStart,earlyFinish:earlyStart+current.duration}); });
  const projectDuration=Math.max(0,...graph.order.map(id=>values.get(id).earlyFinish));
  [...graph.order].reverse().forEach(id=>{ const current=values.get(id); const successors=outgoing.get(id); let lateFinish=projectDuration; let lateStart=lateFinish-current.duration;
    successors.forEach(link=>{ const bound=latestBound(link,values.get(link.toId),current); if(bound.start != null) lateStart=Math.min(lateStart,bound.start); if(bound.finish != null) lateFinish=Math.min(lateFinish,bound.finish); });
    if(successors.some(link=>latestBound(link,values.get(link.toId),current).start != null)) lateFinish=lateStart+current.duration; else lateStart=lateFinish-current.duration;
    const freeFloat=successors.length ? Math.max(0,Math.min(...successors.map(link=>Math.max(0,values.get(link.toId).earlyStart-current.earlyFinish-link.lag)))) : Math.max(0,projectDuration-current.earlyFinish);
    const totalFloat=lateStart-current.earlyStart; values.set(id,{...current,lateStart,lateFinish,totalFloat,freeFloat,critical:Math.abs(totalFloat)<1e-9});
  });
  const result=graph.order.map(id=>values.get(id)); return { activities:result, projectDuration, criticalPath:result.filter(item=>item.critical).map(item=>item.id), nearCriticalPath:result.filter(item=>!item.critical&&item.totalFloat<=1).map(item=>item.id), errors:[] };
}
