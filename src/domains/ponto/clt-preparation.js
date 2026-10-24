import {newCltDraft} from './clt-payslip.js';
import {advanceDeductionForPeriod,isAdvanceActive} from '../rh/advance-commands.js';
import {buildAttendanceImport} from './clt-attendance.js';

export function prepareMonthlyPayslip(data,employee,competence,{transport=false,advances=true}={}){
  const previous=employee.cltPayroll?.drafts?.[competence];
  const profile=employee.cltPayroll?.profile||{};
  const draft=structuredClone(previous||newCltDraft(competence,{...profile,salary:employee.monthlySalary||profile.salary}));
  if(!previous)draft.custom=(profile.recurringRubrics||[]).map(r=>({...r}));
  const options={saturdays:false,dsrPolicy:'none',...profile.attendancePolicy,classifications:previous?.attendanceSource?.options?.classifications||{},reviewed:true};
  const point=buildAttendanceImport(data,employee,competence,options);
  const end=new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).toISOString().slice(0,10);
  if(advances){
    const selected=(data.advances||[]).filter(a=>String(a.empId)===String(employee.id)&&isAdvanceActive(a)&&advanceDeductionForPeriod(a,competence+'-01',end)>0);
    draft.advanceIds=selected.map(a=>a.id);
    draft.advances=selected.map(a=>({id:a.id,date:a.date,amount:advanceDeductionForPeriod(a,competence+'-01',end)}));
  }
  if(transport&&!point.errors.length){
    const attendanceDays=point.rows.filter(r=>['P','M'].includes(r.record?.status)).length;
    draft.transportCost=Math.round(Number(employee.vtDaily||0)*attendanceDays*100)/100;
  }
  // Preparation never confirms a payslip or invents eligibility. Missing data
  // remains explicit; the operator must review the imported source.
  if(!previous)draft.confirmed=false;
  return {draft,point,options,hasPolicy:!!profile.attendancePolicy};
}
