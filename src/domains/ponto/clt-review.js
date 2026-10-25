import {calculateCltPayslip,MANUAL_DAILY_CLT_METHOD} from './clt-payslip.js';
import {attendanceImportIssues} from './clt-attendance.js';
import {advanceDeductionForPeriod,isAdvanceActive} from '../rh/advance-commands.js';
import {remunerationModeOnDate} from '../rh/remuneration-mode.js';
import {employmentRelationshipOnDate} from '../rh/employment-relationship.js';
import {effectiveEmployeeOnDate} from '../rh/remuneration-values.js';

export function reviewMonthlyPayslip(data,employee,competence,{requireManualAudit=true}={}){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence||''))return {employee,draft:null,result:null,errors:['Competência inválida.']};
  const end=new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).toISOString().slice(0,10);
  const draft=employee.cltPayroll?.drafts?.[competence],errors=[];
  if(!draft)return {employee,draft:null,result:null,errors:['Preparar demonstrativo.']};
  const mode=remunerationModeOnDate(employee,end),relationship=employmentRelationshipOnDate(employee,end);
  const manualDaily=draft.assessmentMethod===MANUAL_DAILY_CLT_METHOD;
  if(draft.competence!==competence)errors.push('A competência vinculada ao demonstrativo diverge do mês em revisão.');
  const audit=draft.manualAssessmentAudit;
  if(manualDaily&&requireManualAudit&&(!audit?.reviewedBy||!Number.isFinite(new Date(audit.reviewedAt).getTime())||audit.reference!==draft.assessmentReference||audit.responsible!==draft.assessmentResponsible))errors.push('Salve a conferência identificada da apuração por diária antes de encaminhar ao financeiro.');
  if(mode==='daily'&&relationship==='clt'&&!manualDaily)errors.push('Empregado CLT por diária exige memória de apuração própria; não utilize o demonstrativo mensal automático.');
  if(manualDaily&&(mode!=='daily'||relationship!=='clt'))errors.push('A apuração por diária exige vínculo CLT e remuneração diária na competência.');
  if(manualDaily&&Number(draft.dailyRate)!==Number(effectiveEmployeeOnDate(employee,end).dailyRate))errors.push('A diária de referência diverge da diária contratual vigente. Atualize o demonstrativo.');
  const advanceIds=[...new Set(draft.advanceIds||[])];
  const advances=advanceIds.map(id=>(data.advances||[]).find(a=>a.id===id&&String(a.empId)===String(employee.id)&&isAdvanceActive(a))).filter(Boolean).map(a=>({...a,amount:advanceDeductionForPeriod(a,competence+'-01',end,data)})).filter(a=>a.amount>0);
  if(advances.length!==advanceIds.length||advances.some(a=>!(draft.advances||[]).some(saved=>saved.id===a.id&&saved.amount===a.amount&&saved.date===a.date)))errors.push('Adiantamento alterado; atualize o demonstrativo.');
  const result=calculateCltPayslip({...draft,advances});errors.push(...result.errors,...attendanceImportIssues(data,employee,draft));
  if(!employee.cpf||!draft.registration||!draft.cbo)errors.push('Complete CPF, matrícula e CBO.');
  if(!data.config?.companyName||!data.config?.cnpj)errors.push('Complete razão social e CNPJ.');
  if(mode!=='clt'&&!(mode==='daily'&&relationship==='clt'&&manualDaily))errors.push('Contrato sem modalidade CLT vigente.');
  if(relationship&&relationship!=='clt')errors.push('Vínculo contratual incompatível com a folha CLT.');
  return {employee,draft,result,errors:[...new Set(errors)]};
}
