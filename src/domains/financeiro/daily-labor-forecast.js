import {getPlanningHolidays} from '../ponto/attendance-engine.js';
import {dailyWorkforce,productionHistory,productionRole} from '../diario-obra/production.js';
import {buildLaborProjection} from '../ponto/labor-projection.js';
import {shiftDay} from './cash-forecast.js';

export function dailyLaborForecast(data,{obraId,asOf,budget}){
  const history=productionHistory(data,obraId,asOf,budget),issues=[];
  const dates=[...new Set(Object.values(data.attendance||{}).flatMap(days=>Object.keys(days||{})))].filter(date=>date<=asOf&&date>=shiftDay(asOf,-14)).sort().reverse();
  const rosterDate=dates.find(date=>dailyWorkforce(data,obraId,date).some(row=>['P','M'].includes(row.status)))||'';
  const roster=rosterDate?dailyWorkforce(data,obraId,rosterDate).filter(row=>['P','M'].includes(row.status)):[];
  if(!rosterDate)issues.push('Sem equipe com ponto nos últimos 14 dias nesta obra.');
  const hours=[...new Set(roster.map(row=>row.workdayHours).filter(value=>value>0&&value<=24))];
  const hoursPerDay=hours.length===1&&roster.every(row=>row.workdayHours===hours[0])?hours[0]:null;
  if(!hoursPerDay)issues.push('Jornada comum não encontrada no cadastro da equipe; confira a jornada no RH.');
  const services=history.services.flatMap(source=>{
    issues.push(...source.issues.map(message=>`${source.item.descricao||source.item.id}: ${message}`));
    if(!source.records.length)issues.push(`${source.item.descricao||source.item.id}: falta levantamento revisado no diário.`);
    const rows=source.rows.length?source.rows:[{role:'',hours:null,quantity:null}];
    return rows.map(row=>{
      const samples=source.samples.filter(sample=>sample.allocations.some(person=>person.role===row.role&&person.hours>0));
      return {id:`daily:${source.item.id}:${row.role}`,budgetId:budget.id,budgetItemId:source.item.id,name:source.item.descricao||source.item.nome||source.item.id,unit:source.item.unidade||'',budgetQuantity:source.item.quantidade,remainingQuantity:source.remaining??'',role:row.role,basis:'observed',observedHours:row.hours??'',observedQuantity:row.quantity??'',sourceRecords:source.records.map(record=>`${record.id}@${record.version}:${record.date}`).join(', '),sampleDates:samples.map(sample=>sample.date).join(', '),pointSources:samples.flatMap(sample=>sample.allocations.filter(person=>person.role===row.role).map(person=>person.pointSource)).join('; ')};
    });
  });
  const roleNames=[...new Set([...services.map(service=>service.role),...roster.map(row=>row.role)].filter(Boolean))];
  // Reuse the payroll projection's actual priced rows. Never convert a net wage
  // into a total hourly cost or duplicate these costs as new financial titles.
  const payroll=roster.length?buildLaborProjection(data,{asOf,filters:{obraId}}):null;
  const pricedDays=(payroll?.people||[]).flatMap(person=>person.days||[]).filter(row=>row.partition==='actual'&&['P','M'].includes(row.status)&&row.obraId===obraId);
  const roles=Object.fromEntries(roleNames.map(role=>{
    const days=pricedDays.filter(row=>productionRole(row.role)===role);
    const evidence=days.map(row=>({...row,hours:dailyWorkforce(data,obraId,row.date).find(person=>person.employeeId===row.employeeId)?.hours}));
    const valid=evidence.length&&evidence.every(row=>row.totalCost!==null&&row.hours>0&&!row.provisional);
    const hourlyCost=valid?evidence.reduce((sum,row)=>sum+row.totalCost,0)/evidence.reduce((sum,row)=>sum+row.hours,0):'';
    if(hourlyCost==='')issues.push(`${role}: custo-hora completo indisponível nas parcelas apuradas do ciclo da folha.`);
    return [role,{available:rosterDate?roster.filter(row=>row.role===role).length:'',hourlyCost}];
  }));
  return {excludedDates:getPlanningHolidays(data,[Number(asOf.slice(0,4)),Number(shiftDay(asOf,90).slice(0,4))]).map(day=>day.data),services,roles,hoursPerDay:hoursPerDay??'',start:asOf,end:shiftDay(asOf,27),workSaturday:false,rosterDate,issues:[...new Set(issues)],pending:history.pending,payrollPeriod:payroll?.period};
}
