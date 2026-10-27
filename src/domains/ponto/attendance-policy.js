const CLOCK=/^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const PUNCH_MODE=Object.freeze({
  WITH_BREAK:"with_break",
  ENTRY_EXIT:"entry_exit",
});

const clockMinutes=value=>{
  if(!CLOCK.test(String(value||"")))return null;
  const [hour,minute]=String(value).split(":").map(Number);
  return hour*60+minute;
};

export const normalizePunchMode=value=>
  value===PUNCH_MODE.ENTRY_EXIT?PUNCH_MODE.ENTRY_EXIT:PUNCH_MODE.WITH_BREAK;

export const plannedBreakMinutes=employee=>{
  const start=clockMinutes(employee?.workBreakStart||"12:00");
  const end=clockMinutes(employee?.workBreakEnd||"13:00");
  if(start==null||end==null||end<=start)return 60;
  return end-start;
};

export const attendancePolicyForEmployee=employee=>{
  const punchMode=normalizePunchMode(employee?.attendancePunchMode);
  const workBreakStart=CLOCK.test(String(employee?.workBreakStart||""))
    ?String(employee.workBreakStart):"12:00";
  const workBreakEnd=CLOCK.test(String(employee?.workBreakEnd||""))
    ?String(employee.workBreakEnd):"13:00";
  return {
    punchMode,
    expectedPunchCount:punchMode===PUNCH_MODE.ENTRY_EXIT?2:4,
    workBreakStart,
    workBreakEnd,
    plannedBreakMinutes:plannedBreakMinutes({...employee,workBreakStart,workBreakEnd}),
    timeBankEnabled:employee?.timeBankEnabled===true,
  };
};

export const expectedWorkedMinutes=(employee,status="P")=>{
  const hours=Number(employee?.workdayHours||8);
  if(!Number.isFinite(hours)||hours<=0)return 0;
  const fraction=status==="M"?0.5:status==="P"?1:0;
  return Math.round(hours*60*fraction);
};

export const suggestedTimeBankMinutes=({employee,status="P",workedMinutes=0,paidOvertimeHours=0}={})=>{
  if(employee?.timeBankEnabled!==true||!["P","M"].includes(status))return 0;
  const expected=expectedWorkedMinutes(employee,status);
  const delta=Math.round(Number(workedMinutes||0)-expected);
  if(delta<=0)return delta;
  const paid=Math.max(0,Math.round(Number(paidOvertimeHours||0)*60));
  return Math.max(0,delta-paid);
};

export const validateBreakSchedule=({attendancePunchMode,workBreakStart,workBreakEnd}={})=>{
  const mode=normalizePunchMode(attendancePunchMode);
  const start=clockMinutes(workBreakStart),end=clockMinutes(workBreakEnd);
  if(start==null||end==null)return {ok:false,error:"Informe o início e o retorno previstos do intervalo."};
  if(end<=start)return {ok:false,error:"O retorno do intervalo precisa ser posterior ao início."};
  if(end-start<15||end-start>180)return {ok:false,error:"O intervalo previsto precisa ter entre 15 minutos e 3 horas."};
  return {ok:true,mode,minutes:end-start};
};
