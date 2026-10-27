export const REMUNERATION_VALUE_FIELDS=[
  'dailyRate','monthlySalary','vtDaily','vrDaily','workdayHours','overtimeAdditionalPercent',
  'workStart','attendancePunchMode','workBreakStart','workBreakEnd','timeBankEnabled',
];

const numericDefaults={dailyRate:0,monthlySalary:0,vtDaily:0,vrDaily:0,workdayHours:8,overtimeAdditionalPercent:50};
const textDefaults={workStart:'07:00',attendancePunchMode:'with_break',workBreakStart:'12:00',workBreakEnd:'13:00'};

export function remunerationValues(record={}){
  const values={};
  for(const key of REMUNERATION_VALUE_FIELDS){
    if(key==='timeBankEnabled')values[key]=record.timeBankEnabled===true;
    else if(key in textDefaults)values[key]=String(record[key]||textDefaults[key]);
    else values[key]=Number(record[key]??numericDefaults[key]??0);
  }
  values.monthlySalary=Number(record.monthlySalary)>0?Number(record.monthlySalary):Number(record.cltPayroll?.profile?.salary||0);
  return values;
}

export function effectiveEmployeeOnDate(employee,date){
  if(!employee||!date||!employee.remunerationValuesHistory?.length)return employee;
  const row=[...employee.remunerationValuesHistory].reverse().filter(r=>r.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  return row?{...employee,...Object.fromEntries(REMUNERATION_VALUE_FIELDS.filter(k=>row[k]!=null).map(k=>[k,row[k]]))}:employee;
}
