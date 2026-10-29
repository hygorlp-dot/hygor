import { getQ } from "./attendance-engine.js";

export const PROJECTION_POLICY = Object.freeze({ version:"labor-fortnight-v1", minimumObserved:20, minimumCoverage:0.8, timeZone:"America/Bahia" });
export const isoDay = value => value.toISOString().slice(0,10);
export const addIsoDays = (date,days) => isoDay(new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000));
export const dateRange = (start,end) => {const dates=[];for(let day=start;day<=end;day=addIsoDays(day,1))dates.push(day);return dates;};
export function subtractCalendarMonths(date,months) {
  const [year,month,day]=date.split("-").map(Number);
  const target=new Date(Date.UTC(year,month-1-months,1,12));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(day,last));return isoDay(target);
}
export function projectionPeriod(date) {
  const [year,month,day]=date.split("-").map(Number);
  const reference=new Date(Date.UTC(year,month-1-(day<=5?1:0),1,12));
  const cycle=day>=6&&day<=20?"1":"2";
  const dates=getQ(reference.getUTCFullYear(),reference.getUTCMonth())[cycle==="1"?"q1":"q2"];
  const intervals=[3,2,1].map(offset=>({start:subtractCalendarMonths(dates[0],offset),end:addIsoDays(subtractCalendarMonths(dates[0],offset-1),-1)}));
  return {dates,start:dates[0],end:dates.at(-1),cycle,key:`${dates[0].slice(0,7)}-Q${cycle}`,intervals,historyStart:intervals[0].start,historyEnd:intervals.at(-1).end};
}
export function projectionArchiveKeys(metadata,start,end) {
  return Object.entries(metadata||{}).filter(([key,meta])=>{
    const match=/^(\d{4})-(\d{2})-Q([12])$/.exec(key);if(!match)return false;
    const dates=getQ(Number(match[1]),Number(match[2])-1)[match[3]==="1"?"q1":"q2"];
    return (meta.inicio||dates[0])<=end&&(meta.fim||dates.at(-1))>=start;
  }).map(([key])=>key).sort();
}
export function businessDate(instant) {
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:PROJECTION_POLICY.timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(instant));
  return ["year","month","day"].map(type=>parts.find(item=>item.type===type).value).join("-");
}
