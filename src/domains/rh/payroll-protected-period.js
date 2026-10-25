import {validDate} from './date-validation.js';

// The payment cut can cross months. An identified monthly CLT title protects
// its earning competence, not the first days of the next payroll month.
export function payrollProtectedPeriod(title) {
  const competence=String(title?.competencia||'');
  if(title?.snapshotCalculo?.kind==='advance')return null;
  if(title?.snapshotCalculo?.kind==='clt'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)){
    return {start:competence+'-01',end:new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).toISOString().slice(0,10)};
  }
  if(validDate(title?.periodoFim))return {start:validDate(title?.periodoInicio)?title.periodoInicio:title.periodoFim,end:title.periodoFim};
  if(/^\d{4}-(0[1-9]|1[0-2])$/.test(competence))return {start:competence+'-01',end:new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).toISOString().slice(0,10)};
  return null;
}
