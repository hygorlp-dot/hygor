import {validDate} from './date-validation.js';
export const RH_STEP_TARGET_KEY='mrc_rh_step_target';
export function writeRhStepTarget(value){try{window.sessionStorage.setItem(RH_STEP_TARGET_KEY,JSON.stringify(value));return true;}catch{return false;}}
export function readRhStepTarget(target){
  try{const value=JSON.parse(window.sessionStorage.getItem(RH_STEP_TARGET_KEY)||'null');
    if(value?.target!==target)return null;
    return typeof value.employeeId==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value.competence||'')&&validDate(value.date)?value:null;
  }catch{return null;}
}
export function clearRhStepTarget(target){try{if(readRhStepTarget(target))window.sessionStorage.removeItem(RH_STEP_TARGET_KEY);}catch{/* Navegação continua sem armazenamento. */}}
export function pointCycleForDate(date){
  const ref=new Date(`${date}T12:00:00Z`);
  if(ref.getUTCDate()<=5)ref.setUTCMonth(ref.getUTCMonth()-1);
  return {year:ref.getUTCFullYear(),month:ref.getUTCMonth(),q:Number(date.slice(8))>=6&&Number(date.slice(8))<=20?'1':'2'};
}
