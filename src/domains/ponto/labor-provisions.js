import { money } from "./clt-payslip.js";
import { remunerationModeOnDate } from "../rh/remuneration-mode.js";
import {isCltPayrollOnDate} from '../rh/payroll-classification.js';
import {effectiveEmployeeOnDate} from '../rh/remuneration-values.js';

export const MANUAL_DAILY_CLT_PROVISION='manual_daily_clt_reserve';
const numeric=value=>(typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value));
const nonNegative=value=>numeric(value)&&Number(value)>=0;
const provided=value=>value!==''&&value!=null;
export function provisionReferenceDate(competence){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence||''))return '';
  return new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).toISOString().slice(0,10);
}
export function newProvisionDraft(employee,competence) {
  const date=provisionReferenceDate(competence),monthly=remunerationModeOnDate(employee,date)==='clt';
  const dailyClt=!monthly&&isCltPayrollOnDate(employee,date),effective=effectiveEmployeeOnDate(employee,date);
  return {competence,included:isCltPayrollOnDate(employee,date),base:monthly?effective.monthlySalary||'':'',average:0,
    fgtsPercent:dailyClt?'':employee.cltPayroll?.profile?.rules?.fgtsPercent??8,finePercent:dailyClt?'':40,extraReserve:0,fgtsOnVacation:dailyClt?null:true,
    openingMonth:competence,openingBalance:"",usedReserve:"",fgtsSeveranceBase:"",notes:"",
    ...(dailyClt?{assessmentMethod:MANUAL_DAILY_CLT_PROVISION,assessmentReference:'',assessmentResponsible:'',assessmentMemory:'',assessmentConfirmed:false}:{}),
  };
}
// Classificação vem do contrato vigente. Uma antiga exclusão automática não
// transforma o CLT por diária em reserva dispensada, nem altera o registro salvo.
export function laborProvisionDraftForEmployee(employee,competence,stored=employee.laborProvisions?.[competence]){
  const initial=newProvisionDraft(employee,competence);
  if(!stored)return initial;
  if(initial.assessmentMethod!==MANUAL_DAILY_CLT_PROVISION)return {...stored};
  return {...initial,...stored,competence,included:true,assessmentMethod:MANUAL_DAILY_CLT_PROVISION};
}
export function calculateLaborProvision(draft) {
  const d=draft,errors=[];
  if(d.assessmentMethod===MANUAL_DAILY_CLT_PROVISION){
    if(!d.included)errors.push('O vínculo CLT por diária exige apuração da reserva; não pode ser excluído sem conferência.');
    if(typeof d.assessmentReference!=='string'||!d.assessmentReference.trim())errors.push('Informe a referência da apuração da reserva.');
    if(typeof d.assessmentResponsible!=='string'||!d.assessmentResponsible.trim())errors.push('Identifique o responsável pela apuração da reserva.');
    if(typeof d.assessmentMemory!=='string'||d.assessmentMemory.trim().length<10)errors.push('Registre a memória da base, médias e incidências da reserva (ao menos 10 caracteres).');
    if(d.assessmentConfirmed!==true)errors.push('Confirme a conferência da base e das incidências da reserva.');
    if(typeof d.fgtsOnVacation!=='boolean')errors.push('Informe a incidência de FGTS sobre as férias na reserva.');
  }
  if(!d.included&&errors.length)return {included:true,monthly:0,accumulated:null,errors};
  if(!d.included)return {included:false,monthly:0,accumulated:null,errors:[]};
  for(const key of ["base","average","fgtsPercent","finePercent","extraReserve"]){
    if(!nonNegative(d[key]))errors.push("Informe uma remuneração-base e percentuais válidos, sem valores negativos.");
  }
  if(!(Number(d.base)>0))errors.push("Informe a base mensal apurada para a reserva. A diária não é convertida automaticamente.");
  if(![0,20,40].includes(Number(d.finePercent)))errors.push("Selecione o cenário da multa: sem reserva, acordo (20%) ou dispensa sem justa causa (40%).");
  if(Number(d.fgtsPercent)>100)errors.push("Confira a alíquota do FGTS.");
  for(const key of ["usedReserve","fgtsSeveranceBase"])if(provided(d[key])&&!nonNegative(d[key]))errors.push("Utilização e base do FGTS não podem ser negativas ou inválidas.");
  if(provided(d.openingBalance)&&!numeric(d.openingBalance))errors.push("Informe um saldo de abertura válido.");
  const base=money(Number(d.base||0)+Number(d.average||0)),rate=Number(d.fgtsPercent||0)/100,fineRate=Number(d.finePercent||0)/100;
  const thirteenth=money(base/12),vacation=money(base/12),vacationThird=money(base/36);
  const fgtsOnThirteenth=money(thirteenth*rate),fgtsOnVacation=d.fgtsOnVacation?money((vacation+vacationThird)*rate):0;
  const normalFgts=money(base*rate);
  const fgtsProvision=money(fgtsOnThirteenth+fgtsOnVacation);
  const fine=money((normalFgts+fgtsProvision)*fineRate);
  const monthly=money(thirteenth+vacation+vacationThird+fgtsProvision+fine+Number(d.extraReserve||0));
  const monthIndex=value=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value||""))return NaN;const [y,m]=value.split("-").map(Number);return y*12+m;};
  const months=monthIndex(d.competence)-monthIndex(d.openingMonth)+1;
  if(!Number.isFinite(months)||months<1)errors.push("O primeiro mês da projeção deve ser válido e não pode ser posterior à competência.");
  const hasOpening=numeric(d.openingBalance)&&nonNegative(d.usedReserve)&&Number.isFinite(months)&&months>=1;
  const accumulated=hasOpening?money(Number(d.openingBalance)+monthly*months-Number(d.usedReserve)):null;
  const contingentFine=nonNegative(d.fgtsSeveranceBase)?money(Number(d.fgtsSeveranceBase)*fineRate):null;
  return {included:true,base,thirteenth,vacation,vacationThird,fgtsOnThirteenth,fgtsOnVacation,fgtsProvision,normalFgts,fine,monthly,months,accumulated,contingentFine,errors:[...new Set(errors)]};
}
export function summarizeLaborProvisions(rows) {
  const active=rows.filter(r=>r.result.included);
  const valid=active.filter(r=>!r.result.errors.length);
  const sum=key=>money(valid.reduce((s,r)=>s+Number(r.result[key]||0),0));
  return {employees:active.length,missing:active.length-valid.length,monthly:sum("monthly"),thirteenth:sum("thirteenth"),vacation:sum("vacation"),vacationThird:sum("vacationThird"),fgts:sum("fgtsProvision"),fine:sum("fine"),
    accumulated:sum("accumulated"),missingAccumulated:active.filter(r=>r.result.accumulated===null||r.result.errors.length).length,
    contingentFine:sum("contingentFine"),missingFine:active.filter(r=>r.result.contingentFine===null||r.result.errors.length).length};
}
