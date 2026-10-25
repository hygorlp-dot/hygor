import {calculateCltPayslip} from './clt-payslip.js';
import {attendanceImportIssues} from './clt-attendance.js';
import {advanceDeductionForPeriod,isAdvanceActive} from '../rh/advance-commands.js';
import {remunerationModeOnDate} from '../rh/remuneration-mode.js';

export function reviewMonthlyPayslip(data,employee,competence){
  const end=new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).toISOString().slice(0,10);
  const draft=employee.cltPayroll?.drafts?.[competence],errors=[];
  if(!draft)return {employee,draft:null,result:null,errors:['Preparar demonstrativo.']};
  const advanceIds=[...new Set(draft.advanceIds||[])];
  const advances=advanceIds.map(id=>(data.advances||[]).find(a=>a.id===id&&String(a.empId)===String(employee.id)&&isAdvanceActive(a))).filter(Boolean).map(a=>({...a,amount:advanceDeductionForPeriod(a,competence+'-01',end)})).filter(a=>a.amount>0);
  if(advances.length!==advanceIds.length||advances.some(a=>!(draft.advances||[]).some(saved=>saved.id===a.id&&saved.amount===a.amount&&saved.date===a.date)))errors.push('Adiantamento alterado; atualize o demonstrativo.');
  const result=calculateCltPayslip({...draft,advances});errors.push(...result.errors,...attendanceImportIssues(data,employee,draft));
  if(!employee.cpf||!draft.registration||!draft.cbo)errors.push('Complete CPF, matrícula e CBO.');
  if(!data.config?.companyName||!data.config?.cnpj)errors.push('Complete razão social e CNPJ.');
  if(remunerationModeOnDate(employee,end)!=='clt')errors.push('Contrato sem modalidade CLT vigente.');
  return {employee,draft,result,errors:[...new Set(errors)]};
}
