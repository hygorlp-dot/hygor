import {buildFinancialLedger,active} from '../financeiro/ledger.js';
import {getDays,getAtt,getPayrollHolidays,getHolidayPayRule,isEmployeeEmployedOnDate,prIsWeekdayIso} from '../ponto/attendance-engine.js';
import {calculateAttendanceDayCost} from '../ponto/payroll.js';
import {money} from '../ponto/clt-payslip.js';
import {calculateLaborProvision} from '../ponto/labor-provisions.js';
import {simulatePayMode} from '../ponto/pay-mode-simulation.js';
import {reviewMonthlyPayslip} from '../ponto/clt-review.js';

export function employeeCostReport(data,competence){
  const [year,month]=competence.split('-').map(Number),days=getDays(year,month-1),holidays=getPayrollHolidays(data,year);
  const ledger=buildFinancialLedger(data),titleOwners=new Map((data.titulosFolha||[]).filter(active).map(t=>[String(t.id),String(t.employeeId)]));
  const paymentOwners=new Map((data.pagamentosFolha||[]).filter(active).map(t=>[String(t.id),String(t.employeeId)]));
  const allCash=ledger.events.filter(e=>e.sourceType==='pagamento_folha'&&e.effect==='cash_out'&&e.date?.slice(0,7)===competence);
  const rows=(data.employees||[]).map(employee=>{
    let point=0,benefits=0;
    const pointDetails=[];
    for(const date of days){
      if(!isEmployeeEmployedOnDate(employee,date))continue;
      const holiday=holidays.includes(date)&&prIsWeekdayIso(date);
      const cost=holiday?{laborCost:getHolidayPayRule(data,employee,date,holidays).amount,benefitCost:0}:calculateAttendanceDayCost({employee,record:getAtt(data,employee.id,date),config:data.config,date});
      point+=cost.laborCost;benefits+=cost.benefitCost;
      if(cost.laborCost||cost.benefitCost)pointDetails.push({date,labor:money(cost.laborCost),benefits:money(cost.benefitCost)});
    }
    const reviewed=reviewMonthlyPayslip(data,employee,competence),calculation=reviewed.result;
    const payrollIssues=reviewed.errors;
    const provisionDraft=employee.laborProvisions?.[competence],provision=provisionDraft?calculateLaborProvision(provisionDraft):null;
    const scenarioDraft=employee.payModeSimulations?.[competence],scenario=scenarioDraft?simulatePayMode(employee,scenarioDraft):null;
    const selectedScenario=scenario?.[scenarioDraft?.choice];
    const cash=allCash.filter(e=>String(e.settlesSourceType==='titulo_folha'?titleOwners.get(String(e.sourceId)):paymentOwners.get(String(e.sourceId)))===String(employee.id));
    return {employee,point:money(point),benefits:money(benefits),pointDetails,payroll:calculation&&!payrollIssues.length?calculation:null,payrollIssues,
      provision:provision?.included&&!provision.errors.length?provision:null,
      scenario:selectedScenario&&!selectedScenario.errors.length?selectedScenario:null,
      cash:money(cash.reduce((s,e)=>s+e.amountCents/100,0)),cashDetails:cash};
  });
  const allocated=new Set(rows.flatMap(r=>r.cashDetails.map(e=>e.id)));
  const unallocated=allCash.filter(e=>!allocated.has(e.id));
  const archived=Object.values(data.archivedLaborCosts||{}).some(a=>Object.keys(a.byDate||{}).some(d=>d.startsWith(competence)));
  return {rows,unallocated,archived};
}
