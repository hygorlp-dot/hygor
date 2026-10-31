import { money } from "./clt-payslip.js";
import { remunerationModeOnDate } from "../rh/remuneration-mode.js";
export function newProvisionDraft(employee,competence) {
  const validSalary=value=>Number.isFinite(Number(value))&&Number(value)>0;
  const base=validSalary(employee.monthlySalary)?employee.monthlySalary:validSalary(employee.cltPayroll?.profile?.salary)?employee.cltPayroll.profile.salary:"";
  return {competence,included:remunerationModeOnDate(employee,`${competence}-31`)==="clt",base,average:0,
    fgtsPercent:employee.cltPayroll?.profile?.rules?.fgtsPercent??8,finePercent:40,extraReserve:0,fgtsOnVacation:true,
    openingMonth:competence,openingBalance:"",usedReserve:"",fgtsSeveranceBase:"",notes:""};
}
export function calculateLaborProvision(draft) {
  const d=draft,errors=[];
  if(!d.included)return {included:false,monthly:0,accumulated:null,errors:[]};
  for(const key of ["base","average","fgtsPercent","finePercent","extraReserve"]){
    if(d[key]===""||!Number.isFinite(Number(d[key]))||Number(d[key])<0)errors.push("Informe uma remuneração-base e percentuais válidos, sem valores negativos.");
  }
  if(!(Number(d.base)>0))errors.push("Informe a remuneração mensal para provisionar. A diária não é convertida automaticamente.");
  if(![0,20,40].includes(Number(d.finePercent)))errors.push("Selecione o cenário da multa: sem reserva, acordo (20%) ou dispensa sem justa causa (40%).");
  if(Number(d.fgtsPercent)>100)errors.push("Confira a alíquota do FGTS.");
  for(const key of ["usedReserve","fgtsSeveranceBase"])if(d[key]!==""&&d[key]!=null&&(!Number.isFinite(Number(d[key]))||Number(d[key])<0))errors.push("Utilização e base do FGTS não podem ser negativas ou inválidas.");
  if(d.openingBalance!==""&&!Number.isFinite(Number(d.openingBalance)))errors.push("Informe um saldo de abertura válido.");
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
  const hasOpening=[d.openingBalance,d.usedReserve].every(v=>v!==""&&v!=null&&Number.isFinite(Number(v)))&&Number(d.usedReserve)>=0&&Number.isFinite(months)&&months>=1;
  const accumulated=hasOpening?money(Number(d.openingBalance)+monthly*months-Number(d.usedReserve)):null;
  const contingentFine=d.fgtsSeveranceBase!==""&&Number.isFinite(Number(d.fgtsSeveranceBase))&&Number(d.fgtsSeveranceBase)>=0?money(Number(d.fgtsSeveranceBase)*fineRate):null;
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
