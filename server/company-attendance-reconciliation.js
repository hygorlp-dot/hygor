import {createHash} from 'node:crypto';
import {decodeAppData,encodeAppData} from './data-codec.js';
import {companySourceView} from './company-source-view.js';

export const reconciliationHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const k104Correction={projectId:'47bamabg',employeeId:'emp_028_jefferson_gabriel',dates:['2026-11-12','2026-11-13']};
const requireCorrection=(ok,message)=>{if(!ok)throw new Error(message);};

// Exact, authorized source correction only; never imports finance or other works.
export function reconcileK104Attendance(before,snapshot,updatedAt){
 const {projectId,employeeId,dates}=k104Correction;
 requireCorrection(before.localOnly&&before.companyId==='arcd'&&before.revision===1,'A reconciliação exige a cópia limpa da ARCD na revisão 1.');
 requireCorrection(before.data.obras.some(work=>work.id===projectId&&work.name==='K1-04'),'Identidade da K1-04 divergente.');
 requireCorrection(!Number.isNaN(Date.parse(updatedAt)),'Data da reconciliação inválida.');
 const source=companySourceView(snapshot.tables,'arcd').data;
 const state=structuredClone(before),keys=['arced_ponto_v1','arced_ponto_v1__ponto__obra__'+projectId];
 for(const date of dates){
  const old=before.data.attendance?.[employeeId]?.[date],current=source.attendance?.[employeeId]?.[date];
  requireCorrection(old?.obraId===projectId&&old.status==='P'&&current?.obraId===projectId&&current.status==='F','A origem não confirma a correção autorizada.');
  requireCorrection(reconciliationHash({...old,status:'F'})===reconciliationHash(current),'A marcação contém outras alterações; exige nova conferência.');
  state.data.attendance[employeeId][date].status='F';
  for(const key of keys){
   const row=state.tables.company_app_data.find(row=>row.key===key),value=decodeAppData(row?.value);
   requireCorrection(value?.attendance?.[employeeId]?.[date]?.status==='P'&&value.attendance[employeeId][date].obraId===projectId,'Cópia persistida da marcação divergente.');
   value.attendance[employeeId][date].status='F';row.value=encodeAppData(value);
  }
 }
 state.revision=2;state.updatedAt=updatedAt;
 state.receipts=[...(state.receipts||[]),{kind:'k104-attendance-reconciliation',sourceHash:reconciliationHash(snapshot),projectId,employeeId,dates,updatedAt}];
 return state;
}
