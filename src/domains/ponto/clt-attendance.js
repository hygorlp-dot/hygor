import {ATTENDANCE_STATUSES} from "./attendance-status.js";
import {getAtt,getDays,getPayrollHolidays,isEmployeeEmployedOnDate,isAttendanceLocked} from './attendance-engine.js';
import {resolveEmployeeAttendanceObraId} from './permissions.js';
import {money} from './clt-payslip.js';
import {calculateTimekeeping} from './timekeeping.js';
import {remunerationModeOnDate} from '../rh/remuneration-mode.js';

export const ATTENDANCE_FIELDS=['workedDays','absenceDays','dsrLostDays','overtimeHours','extraordinaryHours','dsrWorkingDays','dsrRestDays'];
export const hasPartialContractMonth=(employee,competence)=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence||''))return false;
  const first=competence+'-01',end=new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).toISOString().slice(0,10);
  return employee.startDate>first&&employee.startDate<=end||employee.endDate>=first&&employee.endDate<end||employee.remunerationEffectiveFrom>first&&employee.remunerationEffectiveFrom<=end||(employee.remunerationHistory||[]).some(r=>r.date>first&&r.date<=end);
};
export function monthlyAttendance(data,employee,competence,options={}) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence))return {rows:[],errors:['Competência inválida.'],signature:''};
  const [year,month]=competence.split('-').map(Number),holidays=new Set(getPayrollHolidays(data,year));
  const days=getDays(year,month-1).filter(d=>isEmployeeEmployedOnDate(employee,d)&&remunerationModeOnDate(employee,d)==='clt');
  const rows=days.map(date=>{
    const record=getAtt(data,employee.id,date),weekday=new Date(date+'T12:00:00Z').getUTCDay();
    const scheduled=weekday>0&&(weekday<6||options.saturdays)&&!holidays.has(date);
    const obraId=resolveEmployeeAttendanceObraId({data,employee,date});
    const lock=data.attendanceLocks?.[`${date}__${obraId}`];
    return {date,weekday,holiday:holidays.has(date),scheduled,record,obraId,approved:isAttendanceLocked(data,obraId,date),lock};
  });
  const errors=[];
  if(!days.length)errors.push('Não há dias de vínculo nesta competência.');
  for(const row of rows)if(row.scheduled||row.record?.status){
    if(!row.record?.status&&row.scheduled)errors.push(`${row.date}: ponto sem registro; não é considerado falta.`);
    if(!row.approved)errors.push(`${row.date}: feche o ponto da obra antes de importar.`);
    if(row.record?.status&&!ATTENDANCE_STATUSES.includes(row.record.status))errors.push(`${row.date}: situação não reconhecida.`);
  }
  // Full source material, not a weak numeric hash. Includes locks and clocks,
  // so reopening or correcting the source invalidates the payroll snapshot.
  const signature=JSON.stringify({employee:[employee.id,employee.startDate||'',employee.endDate||'',employee.obra||''],rows});
  return {rows,errors,signature};
}
export function buildAttendanceImport(data,employee,competence,options={}) {
  const source=monthlyAttendance(data,employee,competence,options),errors=[...source.errors];
  const fields={workedDays:0,absenceDays:0,dsrLostDays:0,overtimeHours:0,extraordinaryHours:0,dsrWorkingDays:0,dsrRestDays:0};
  const lost=new Set();
  for(const row of source.rows){
    const r=row.record,choice=options.classifications?.[row.date]||{};
    if(row.scheduled)fields.dsrWorkingDays++;
    if(row.weekday===0||row.holiday)fields.dsrRestDays++;
    if(!r?.status)continue;
    fields.workedDays+=r.status==='P'?1:r.status==='M'?.5:0;
    if(['F','M'].includes(r.status)){
      if(!['justified','unjustified'].includes(choice.absence))errors.push(`${row.date}: classifique a ausência ou meio período.`);
      if(choice.absence==='unjustified'){
        fields.absenceDays+=r.status==='M'?.5:1;
        const sunday=new Date(row.date+'T12:00:00Z');sunday.setUTCDate(sunday.getUTCDate()+7-sunday.getUTCDay());
        if(sunday.toISOString().slice(0,7)===competence)lost.add(sunday.toISOString().slice(0,10));
      }
    }
    if(Number(r.ot)>0){
      const normal=Number(choice.normal),special=Number(choice.special);
      if(!['P','M'].includes(r.status)||choice.normal==null||choice.special==null||!Number.isFinite(normal)||!Number.isFinite(special)||normal<0||special<0||Math.abs(normal+special-Number(r.ot))>.001)errors.push(`${row.date}: distribua as ${r.ot} horas extras entre os adicionais da CCT.`);
      else {fields.overtimeHours+=normal;fields.extraordinaryHours+=special;}
    }
    const clocks=calculateTimekeeping({...r,jornadaInicio:employee.workStart||'07:00'});
    if((!clocks.valid||clocks.delayMinutes>0||Number(r.atrasoMin)>0)&&String(options.timeReview||'').trim().length<10)errors.push('Há horários incompletos ou atrasos. Registre a decisão sobre descontos/compensações e as rubricas correspondentes.');
  }
  if(!['none','weekly'].includes(options.dsrPolicy))errors.push('Defina o tratamento de DSR após analisar as justificativas.');
  if(options.dsrPolicy==='weekly')fields.dsrLostDays=lost.size;
  if(!options.reviewed)errors.push('O RH precisa confirmar a classificação e as regras da importação.');
  return {fields:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,money(v)])),rows:source.rows,errors:[...new Set(errors)],signature:source.signature};
}
export function attendanceImportIssues(data,employee,draft){
  const source=draft?.attendanceSource;
  const contractIssues=draft&&hasPartialContractMonth(employee,draft.competence)&&!draft.contractPeriodReviewed?['Mês de admissão, desligamento ou mudança de modalidade: revise dias de salário e confirme a proporcionalidade.']:[];
  if(!source||source.manualReason)return contractIssues;
  const current=buildAttendanceImport(data,employee,draft.competence,source.options);
  const errors=[...contractIssues,...current.errors];
  if(current.signature!==source.signature)errors.push('O ponto mudou ou foi reaberto. Atualize a importação antes de salvar ou imprimir.');
  if(ATTENDANCE_FIELDS.some(key=>Number(draft[key])!==current.fields[key]))errors.push('Os eventos divergem do ponto importado. Reimporte ou registre um ajuste manual justificado.');
  return errors;
}
