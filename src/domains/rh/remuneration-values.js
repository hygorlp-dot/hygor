export const REMUNERATION_VALUE_FIELDS=['dailyRate','monthlySalary','vtDaily','vrDaily','workdayHours','overtimeAdditionalPercent','workStart'];
export function remunerationValues(record={}){
  return {...Object.fromEntries(REMUNERATION_VALUE_FIELDS.filter(key=>key!=='workStart').map(key=>[key,Number(record[key]??(key==='workdayHours'?8:key==='overtimeAdditionalPercent'?50:0))])),
    monthlySalary:Number(record.monthlySalary)>0?Number(record.monthlySalary):Number(record.cltPayroll?.profile?.salary||0),workStart:record.workStart||'07:00'};
}
export function effectiveEmployeeOnDate(employee,date){
  if(!employee||!date||!employee.remunerationValuesHistory?.length)return employee;
  const row=[...employee.remunerationValuesHistory].reverse().filter(r=>r.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  return row?{...employee,...Object.fromEntries(REMUNERATION_VALUE_FIELDS.filter(k=>row[k]!=null).map(k=>[k,row[k]]))}:employee;
}
