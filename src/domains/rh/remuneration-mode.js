export function remunerationModeOnDate(employee,date) {
  const history=[...(employee?.remunerationHistory||[])].reverse().filter(item=>item.date<=date).sort((a,b)=>b.date.localeCompare(a.date));
  if(history.length)return history[0].mode==="clt"?"clt":"daily";
  if(employee?.remunerationHistory?.length)return "daily";
  return employee?.remunerationMode==="clt"&&date>=(employee.remunerationEffectiveFrom||employee.startDate||"9999")?"clt":"daily";
}
