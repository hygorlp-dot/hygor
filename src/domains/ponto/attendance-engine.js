import { normalizeAttendanceRecord } from "./records.js";

export const toLocalISODate = value => {
  const date=value instanceof Date?value:new Date(value);
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,"0");
  const day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
};

const daysCache=new Map();
export const getDays=(year,monthIndex)=>{
  const key=`${year}-${monthIndex}`;
  const cached=daysCache.get(key);
  if(cached)return cached;
  const days=[];
  const date=new Date(year,monthIndex,1,12,0,0);
  while(date.getMonth()===monthIndex){
    days.push(toLocalISODate(date));
    date.setDate(date.getDate()+1);
  }
  daysCache.set(key,days);
  return days;
};

export const getQ=(year,monthIndex)=>{
  const current=getDays(year,monthIndex);
  const nextReference=new Date(year,monthIndex+1,1,12,0,0);
  const next=getDays(nextReference.getFullYear(),nextReference.getMonth());
  return {
    q1:current.filter(date=>{
      const day=Number(date.split("-")[2]);
      return day>=6&&day<=20;
    }),
    q2:[
      ...current.filter(date=>Number(date.split("-")[2])>=21),
      ...next.filter(date=>Number(date.split("-")[2])<=5),
    ],
  };
};

export const getAtt=(data,employeeId,date)=>
  normalizeAttendanceRecord(data?.attendance?.[employeeId]?.[date]);

export const attStatus=(data,employeeId,date)=>getAtt(data,employeeId,date)?.status||null;

export const isEmployeeEmployedOnDate=(employee,date)=>{
  if(!employee)return false;
  if(employee.startDate&&date<employee.startDate)return false;
  if(employee.endDate&&date>employee.endDate)return false;
  return true;
};

const employeeHasRecordInPeriod=(data,employee,days)=>
  (days||[]).some(date=>{
    const record=getAtt(data,employee?.id,date);
    return Boolean(
      record?.status
      || Number(record?.ot||0)>0
      || String(record?.note||"").trim()
    );
  });

export const employeeRelevantInPeriod=(data,employee,days)=>{
  if(!employee)return false;
  return (days||[]).some(date=>isEmployeeEmployedOnDate(employee,date))
    || employeeHasRecordInPeriod(data,employee,days);
};

export const employeeRelevantOnDate=(data,employee,date)=>
  isEmployeeEmployedOnDate(employee,date)||Boolean(getAtt(data,employee?.id,date));

const dateAtNoon=(year,monthIndex,day)=>new Date(year,monthIndex,day,12,0,0);
const iso=date=>toLocalISODate(date);
export const prParseIso=value=>{
  const [year,month,day]=String(value||"").split("-").map(Number);
  return dateAtNoon(year,month-1,day);
};
const addDays=(value,days)=>{
  const date=new Date(value);
  date.setDate(date.getDate()+days);
  return dateAtNoon(date.getFullYear(),date.getMonth(),date.getDate());
};
export const prUniqueDates=values=>[...new Set((values||[]).filter(Boolean))].sort();

const easterDate=year=>{
  const a=year%19;
  const b=Math.floor(year/100);
  const c=year%100;
  const d=Math.floor(b/4);
  const e=b%4;
  const f=Math.floor((b+8)/25);
  const g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4);
  const k=c%4;
  const l=(32+2*e+2*i-h-k)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31)-1;
  const day=((h+l-7*m+114)%31)+1;
  return dateAtNoon(year,month,day);
};

const holidaysCache=new Map();
export const getOfficialHolidaysCaruaruPE=year=>{
  const cached=holidaysCache.get(year);
  if(cached)return cached;
  const easter=easterDate(year);
  const result=prUniqueDates([
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-11-20`,
    `${year}-12-25`,
    `${year}-03-06`,
    iso(addDays(easter,-2)),
    `${year}-05-18`,
    iso(addDays(easter,60)),
    `${year}-06-24`,
    `${year}-09-15`,
  ]);
  holidaysCache.set(year,result);
  return result;
};

export const getPayrollHolidays=(data,year)=>{
  const custom=(data?.config?.paymentHolidays||[])
    .map(holiday=>typeof holiday==="string"?holiday:(holiday?.date||""))
    .filter(Boolean);
  return prUniqueDates([...getOfficialHolidaysCaruaruPE(year),...custom]);
};

export const getPlanningHolidays=(data,years=[])=>{
  const selectedYears=[...new Set(years.map(Number).filter(Boolean))];
  const byDate=new Map();
  selectedYears.forEach(year=>{
    getOfficialHolidaysCaruaruPE(year).forEach(date=>{
      if(!byDate.has(date))byDate.set(date,{data:date,nome:"Feriado oficial"});
    });
  });
  (data?.config?.paymentHolidays||[]).forEach(holiday=>{
    const date=typeof holiday==="string"?holiday:(holiday?.date||holiday?.data||"");
    if(!date||!selectedYears.includes(Number(date.slice(0,4))))return;
    const name=typeof holiday==="string"
      ?"Feriado cadastrado"
      :(holiday?.name||holiday?.nome||"Feriado cadastrado");
    byDate.set(date,{data:date,nome:name});
  });
  return [...byDate.values()].sort((left,right)=>left.data.localeCompare(right.data));
};

const isHoliday=(date,holidays)=>holidays.includes(iso(date));
const isWeekend=date=>[0,6].includes(date.getDay());
const isNonBusinessDay=(date,holidays)=>isWeekend(date)||isHoliday(date,holidays);
const previousBusinessDay=(value,holidays)=>{
  let date=addDays(value,-1);
  while(isNonBusinessDay(date,holidays))date=addDays(date,-1);
  return date;
};
const nextBusinessDay=(value,holidays)=>{
  let date=addDays(value,1);
  while(isNonBusinessDay(date,holidays))date=addDays(date,1);
  return date;
};

const adjustPayrollPaymentDate=(baseDate,holidays)=>{
  const day=baseDate.getDay();
  if(day===6)return previousBusinessDay(baseDate,holidays);
  if(day===0)return nextBusinessDay(baseDate,holidays);
  if(isHoliday(baseDate,holidays)){
    const previousDay=addDays(baseDate,-1);
    return previousDay.getDay()===0
      ?nextBusinessDay(baseDate,holidays)
      :previousBusinessDay(baseDate,holidays);
  }
  return baseDate;
};

export const getPayrollPaymentCalendar=(year,monthIndex,fortnight,data)=>{
  const paymentMonth=fortnight==="1"?monthIndex:monthIndex+1;
  const paymentYear=paymentMonth>11?year+1:year;
  const normalizedMonth=paymentMonth>11?0:paymentMonth;
  const baseDate=dateAtNoon(paymentYear,normalizedMonth,fortnight==="1"?20:5);
  const adjustedDate=adjustPayrollPaymentDate(
    baseDate,
    getPayrollHolidays(data,paymentYear),
  );
  return {
    baseDate:iso(baseDate),
    paymentDate:iso(adjustedDate),
    adjusted:iso(baseDate)!==iso(adjustedDate),
  };
};

export const prIsWeekdayIso=value=>{
  const day=prParseIso(value).getDay();
  return day>=1&&day<=5;
};

const previousWorkdayIso=(value,holidays)=>{
  let date=addDays(prParseIso(value),-1);
  while(isNonBusinessDay(date,holidays))date=addDays(date,-1);
  return iso(date);
};
const nextWorkdayIso=(value,holidays)=>{
  let date=addDays(prParseIso(value),1);
  while(isNonBusinessDay(date,holidays))date=addDays(date,1);
  return iso(date);
};

export const getHolidayPayRule=(data,employee,holidayIso,holidays)=>{
  const before=previousWorkdayIso(holidayIso,holidays);
  const after=nextWorkdayIso(holidayIso,holidays);
  const missedBefore=getAtt(data,employee.id,before)?.status==="F";
  const missedAfter=getAtt(data,employee.id,after)?.status==="F";
  return {
    holidayIso,
    before,
    after,
    missedBefore,
    missedAfter,
    losesHoliday:missedBefore||missedAfter,
    amount:missedBefore||missedAfter?0:Number(employee.dailyRate||0),
  };
};

const attendanceLockKey=(obraId,date)=>`${date}__${obraId}`;
const getAttendanceLock=(data,obraId,date)=>
  data?.attendanceLocks?.[attendanceLockKey(obraId,date)]||null;
export const isAttendanceLocked=(data,obraId,date)=>Boolean(getAttendanceLock(data,obraId,date)?.locked);

export const hasApprovedUnlock=(data,obraId,date,userId="",now=new Date())=>
  (data?.unlockRequests||[]).some(request=>
    request.obraId===obraId
    && request.date===date
    && request.status==="approved"
    && Boolean(request.requestedById)
    && String(request.requestedById)===String(userId)
    && request.validUntil
    && new Date(request.validUntil)>now
  );

export const canEditAttendance=(data,obraId,date,userId="")=>
  !isAttendanceLocked(data,obraId,date)||hasApprovedUnlock(data,obraId,date,userId);

const formatFullDate=value=>{
  if(!value||typeof value!=="string"||!value.includes("-"))return "-";
  const [year,month,day]=value.split("-");
  return `${day}/${month}/${year}`;
};

export const buildPermissionEmail=({
  to,
  obraName,
  date,
  employeeName,
  reason,
  approvalLink,
})=>{
  const subject=`Permissão para alterar ponto - ${obraName} - ${formatFullDate(date)}`;
  const body=[
    "Solicitação de permissão para alteração de ponto.",
    "",
    `Obra: ${obraName}`,
    `Data do ponto: ${formatFullDate(date)}`,
    employeeName?`Trabalhador: ${employeeName}`:"Trabalhador: todos / não especificado",
    "",
    "Motivo informado:",
    reason||"Não informado.",
    "",
    "Para aprovar a alteração por 30 minutos, acesse o link abaixo:",
    approvalLink,
    "",
    "Observação: a aprovação pelo link exige que o aprovador tenha acesso ao sistema.",
    "",
    "Solicitação gerada automaticamente pelo sistema ArcD Obras.",
  ].join("\n");
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const getAttendanceStatusForDate=(data,employeeId,date)=>
  getAtt(data,employeeId,date)?.status||null;
const isValidAttendanceStatus=status=>["P","M","F"].includes(status);

export const getObraAttendanceSummary=(data,date)=>{
  const obras=(data?.obras||[]).filter(obra=>obra.status!=="done");
  const employees=(data?.employees||[]).filter(employee=>employee.active!==false);
  return obras.map(obra=>{
    const team=employees.filter(employee=>
      employee.obra===obra.id&&isEmployeeEmployedOnDate(employee,date));
    const registeredEmployees=team.filter(employee=>
      isValidAttendanceStatus(getAttendanceStatusForDate(data,employee.id,date)));
    const missingEmployees=team.filter(employee=>
      !isValidAttendanceStatus(getAttendanceStatusForDate(data,employee.id,date)));
    return {
      obraId:obra.id,
      obraName:obra.name,
      totalEmployees:team.length,
      registeredCount:registeredEmployees.length,
      missingCount:missingEmployees.length,
      completed:team.length>0&&missingEmployees.length===0,
      hasTeam:team.length>0,
      missingEmployees,
    };
  });
};

export const getAttendanceCompletionMessage=summary=>{
  const obrasWithTeam=summary.filter(obra=>obra.hasTeam);
  const pendingObras=summary.filter(obra=>obra.hasTeam&&!obra.completed);
  const completedObras=summary.filter(obra=>obra.hasTeam&&obra.completed);
  const obrasWithoutTeam=summary.filter(obra=>!obra.hasTeam);
  return {
    allDone:obrasWithTeam.length>0&&pendingObras.length===0,
    pendingObras,
    completedObras,
    obrasWithoutTeam,
    totalWithTeam:obrasWithTeam.length,
  };
};
