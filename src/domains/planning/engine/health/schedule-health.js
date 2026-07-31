export function assessScheduleHealth({ activities = [], dependencies = [], calendars = [] } = {}) {
  const byId=new Set(activities.map(item=>String(item.id))); const incoming=new Map([...byId].map(id=>[id,0])); const outgoing=new Map([...byId].map(id=>[id,0]));
  dependencies.forEach(link=>{const from=String(link.fromId || link.predecessorId);const to=String(link.toId || link.successorId);if(byId.has(from))outgoing.set(from,outgoing.get(from)+1);if(byId.has(to))incoming.set(to,incoming.get(to)+1);});
  const findings=[]; activities.filter(item=>item.status!=="cancelled").forEach(item=>{const id=String(item.id);const duration=Number(item.duration ?? item.durationDays ?? 0);
    if(!item.wbsId)findings.push({severity:"warning",code:"missing_wbs",activityId:id,message:"Atividade sem pacote EAP."});
    if(!item.responsibleId)findings.push({severity:"warning",code:"missing_responsible",activityId:id,message:"Atividade sem responsável."});
    if(!item.calendarId && calendars.length>1)findings.push({severity:"warning",code:"missing_calendar",activityId:id,message:"Atividade sem calendário definido."});
    if(duration > 20)findings.push({severity:"warning",code:"long_duration",activityId:id,message:"Atividade com duração superior a 20 dias úteis."});
    if(Number(item.percentComplete ?? 0)>0 && !item.progressMethod)findings.push({severity:"warning",code:"missing_progress_method",activityId:id,message:"Progresso sem método declarado."});
    if(incoming.get(id)===0&&outgoing.get(id)===0&&activities.length>1)findings.push({severity:"info",code:"isolated_activity",activityId:id,message:"Atividade isolada da rede lógica."});
  });
  const score=Math.max(0,100-findings.reduce((sum,item)=>sum+(item.severity==="warning"?8:3),0)); return { score, findings, warnings:findings.filter(item=>item.severity==="warning").length, info:findings.filter(item=>item.severity==="info").length };
}
