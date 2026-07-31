import { STAGE_PROBABILITY } from "./constants.js";
import { canonicalActivities, nextActivityFor, activityPriority } from "./activities.js";
export const selectCommercialWorkspace=(commercial,now=Date.now())=>{
  const activities=canonicalActivities(commercial);const opportunities=commercial?.opportunities||[];
  return opportunities.filter(item=>!["ganho","perdido","arquivado"].includes(item.stage)).map(item=>{
    const next=nextActivityFor(activities,{opportunityId:item.id,leadId:item.leadId},now);
    return {...item,nextActivity:next,priority:activityPriority(next,now),daysInStage:Math.max(0,Math.floor((now-new Date(item.stageSince||item.createdAt||now).getTime())/86400000)),weightedValue:Number(item.estimatedValue||0)*(Number(item.probability??(STAGE_PROBABILITY[item.stage]||0))/100)};
  }).sort((a,b)=>a.priority-b.priority||b.weightedValue-a.weightedValue||b.daysInStage-a.daysInStage);
};
export const selectForecast=opportunities=>(opportunities||[]).reduce((out,item)=>{const category=item.forecastCategory||item.stage||"pipeline";out[category]=(out[category]||0)+Number(item.estimatedValue||0)*(Number(item.probability??(STAGE_PROBABILITY[item.stage]||0))/100);return out;},{});
