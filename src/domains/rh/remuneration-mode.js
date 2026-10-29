// Modalidades de remuneração: diária (ponto), CLT mensal (holerite) e MEI
// (valor fixo mensal contra nota fiscal, sem ponto e sem encargos).
export const REMUNERATION_MODES=Object.freeze(["daily","clt","mei"]);
export const normalizeRemunerationMode=value=>REMUNERATION_MODES.includes(value)?value:"daily";

export function remunerationModeOnDate(employee,date) {
  const history=[...(employee?.remunerationHistory||[])].reverse().filter(item=>item.date<=date).sort((a,b)=>b.date.localeCompare(a.date));
  if(history.length)return normalizeRemunerationMode(history[0].mode);
  if(employee?.remunerationHistory?.length)return "daily";
  const mode=normalizeRemunerationMode(employee?.remunerationMode);
  return mode!=="daily"&&date>=(employee.remunerationEffectiveFrom||employee.startDate||"9999")?mode:"daily";
}
