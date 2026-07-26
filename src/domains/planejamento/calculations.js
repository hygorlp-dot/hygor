import { DEPENDENCY_TYPES } from "./constants.js";

const n=value=>Math.max(0,Number(value||0));
const dependency=(value={})=>({fromId:String(value.fromId||""),toId:String(value.toId||""),type:value.type||"FS",lagDays:Number(value.lagDays||0)});

export const topologicalOrder=(activities=[],dependencies=[])=>{
  const ids=new Set(activities.map(item=>String(item.id)));const indegree=new Map([...ids].map(id=>[id,0]));const next=new Map([...ids].map(id=>[id,[]]));
  dependencies.map(dependency).forEach(link=>{
    if(!ids.has(link.fromId)||!ids.has(link.toId))throw new Error("Dependência aponta para atividade inexistente.");
    if(!DEPENDENCY_TYPES.includes(link.type))throw new Error("Tipo de dependência inválido.");
    indegree.set(link.toId,indegree.get(link.toId)+1);next.get(link.fromId).push(link);
  });
  const queue=[...ids].filter(id=>indegree.get(id)===0).sort();const ordered=[];
  while(queue.length){const id=queue.shift();ordered.push(id);next.get(id).forEach(link=>{const nextDegree=indegree.get(link.toId)-1;indegree.set(link.toId,nextDegree);if(nextDegree===0)queue.push(link.toId);});queue.sort();}
  if(ordered.length!==ids.size)throw new Error("Cronograma possui dependência cíclica.");
  return ordered;
};

const forwardStart=(link,from,current)=>{
  const lag=Number(link.lagDays||0),duration=n(current.durationDays);
  if(link.type==="FS")return from.earlyFinish+lag;
  if(link.type==="SS")return from.earlyStart+lag;
  if(link.type==="FF")return from.earlyFinish+lag-duration;
  return from.earlyStart+lag-duration; // SF
};
const latestBound=(link,successor,current)=>{
  const lag=Number(link.lagDays||0),duration=n(current.durationDays);
  if(link.type==="FS")return {latestFinish:successor.latestStart-lag};
  if(link.type==="SS")return {latestStart:successor.latestStart-lag};
  if(link.type==="FF")return {latestFinish:successor.latestFinish-lag};
  return {latestStart:successor.latestFinish-lag}; // SF
};

export const calculateCPM=(activities=[],dependencies=[],{projectStartDay=0}={})=>{
  const order=topologicalOrder(activities,dependencies);const source=new Map(activities.map(item=>[String(item.id),{...item,id:String(item.id),durationDays:n(item.durationDays)}]));
  const incoming=new Map(order.map(id=>[id,[]])),outgoing=new Map(order.map(id=>[id,[]]));dependencies.map(dependency).forEach(link=>{incoming.get(link.toId).push(link);outgoing.get(link.fromId).push(link);});
  const calculated=new Map();
  order.forEach(id=>{const activity=source.get(id);const predecessorStarts=incoming.get(id).map(link=>forwardStart(link,calculated.get(link.fromId),activity));const earlyStart=Math.max(Number(projectStartDay||0),...predecessorStarts);calculated.set(id,{...activity,earlyStart,earlyFinish:earlyStart+activity.durationDays});});
  const projectDuration=Math.max(0,...[...calculated.values()].map(item=>item.earlyFinish));
  [...order].reverse().forEach(id=>{const activity=calculated.get(id);const successors=outgoing.get(id);let latestStart=projectDuration-activity.durationDays,latestFinish=projectDuration;
    successors.forEach(link=>{const bound=latestBound(link,calculated.get(link.toId),activity);if(bound.latestStart!=null)latestStart=Math.min(latestStart,bound.latestStart);if(bound.latestFinish!=null)latestFinish=Math.min(latestFinish,bound.latestFinish);});
    if(successors.some(link=>latestBound(link,calculated.get(link.toId),activity).latestStart!=null))latestFinish=latestStart+activity.durationDays;else latestStart=latestFinish-activity.durationDays;
    const totalFloat=latestStart-activity.earlyStart;calculated.set(id,{...activity,latestStart,latestFinish,totalFloat,critical:Math.abs(totalFloat)<1e-9});
  });
  return {projectStartDay:Number(projectStartDay||0),projectDuration,activities:order.map(id=>calculated.get(id)),criticalPath:order.filter(id=>calculated.get(id).critical),order};
};

export const calculateEarnedValue=({plannedCents=0,earnedCents=0,actualCents=0,budgetAtCompletionCents=0}={})=>{
  const pv=Math.round(plannedCents),ev=Math.round(earnedCents),ac=Math.round(actualCents),bac=Math.round(budgetAtCompletionCents||plannedCents);
  const spi=pv?ev/pv:null,cpi=ac?ev/ac:null,eac=cpi&&cpi>0?Math.round(bac/cpi):null,etc=eac==null?null:eac-ac;
  return {pv,ev,ac,bac,spi,cpi,sv:ev-pv,cv:ev-ac,eac,etc,vac:eac==null?null:bac-eac};
};

export const calculatePPC=(commitments=[])=>{
  const active=commitments.filter(item=>item.status!=="cancelado"),blocked=active.filter(item=>item.status==="bloqueado"),eligible=active.filter(item=>item.status!=="bloqueado"),done=eligible.filter(item=>item.status==="concluido");
  const causes={};eligible.filter(item=>item.status==="nao_concluido").forEach(item=>{const cause=String(item.motivoNaoCumprimento||"não informado");causes[cause]=(causes[cause]||0)+1;});
  return {total:eligible.length,completed:done.length,blocked:blocked.length,ppc:eligible.length?done.length/eligible.length:0,causes:Object.entries(causes).sort((a,b)=>b[1]-a[1]).map(([cause,count])=>({cause,count}))};
};

export const calculateProductivity=({quantity=0,workerHours=0,equipmentHours=0,actualCostCents=0,budgetQuantity=0,budgetWorkerHours=0}={})=>{
  const qty=n(quantity),hours=n(workerHours),equip=n(equipmentHours),cost=Math.round(actualCostCents||0);const hhPerUnit=qty?hours/qty:null,productivity=hours?qty/hours:null,budgetHHPerUnit=n(budgetQuantity)?n(budgetWorkerHours)/n(budgetQuantity):null;
  return {quantity:qty,workerHours:hours,equipmentHours:equip,hhPerUnit,productivity,unitCostCents:qty?Math.round(cost/qty):null,productivityDeviation:budgetHHPerUnit!=null&&hhPerUnit!=null?hhPerUnit-budgetHHPerUnit:null};
};
