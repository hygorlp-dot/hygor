import {normalizeAttendanceRecord} from "./records.js";

const text=value=>String(value??"");
const activeAdjustment=item=>item&&item.status!=="reversed";

export const timeBankAttendanceEntries=(data,employeeId)=>{
  const days=data?.attendance?.[employeeId]||{};
  return Object.entries(days).flatMap(([date,value])=>{
    const record=normalizeAttendanceRecord(value);
    const minutes=Math.round(Number(record?.bankMinutes||0));
    if(!record?.status||!minutes)return [];
    return [{
      id:`attendance:${employeeId}:${date}`,
      employeeId:String(employeeId),
      date,
      minutes,
      type:"attendance",
      source:"attendance",
      obraId:text(record.obraId),
      reason:text(record.bankReason||record.note||"Saldo do ponto"),
    }];
  });
};

export const timeBankManualEntries=(data,employeeId)=>
  (data?.timeBankAdjustments||[])
    .filter(item=>activeAdjustment(item)&&String(item.employeeId)===String(employeeId))
    .map(item=>({...item,minutes:Math.round(Number(item.minutes||0)),type:item.type||"adjustment",source:"manual"}));

export const timeBankStatement=(data,employeeId,{throughDate=""}={})=>
  [...timeBankAttendanceEntries(data,employeeId),...timeBankManualEntries(data,employeeId)]
    .filter(item=>!throughDate||String(item.date||"")<=throughDate)
    .sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))||String(a.id||"").localeCompare(String(b.id||"")));

export const timeBankBalanceMinutes=(data,employeeId,options={})=>
  timeBankStatement(data,employeeId,options).reduce((sum,item)=>sum+Math.round(Number(item.minutes||0)),0);

export const formatTimeBankMinutes=value=>{
  const minutes=Math.round(Number(value||0));
  const sign=minutes>0?"+":minutes<0?"−":"";
  const absolute=Math.abs(minutes);
  return `${sign}${Math.floor(absolute/60)}h${String(absolute%60).padStart(2,"0")}`;
};
