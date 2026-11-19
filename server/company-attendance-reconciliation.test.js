// @vitest-environment node
import {it,expect} from 'vitest';
import {reconcileK104Attendance,k104Correction,reconciliationHash} from './company-attendance-reconciliation.js';
import {decodeAppData} from './data-codec.js';
const fixture=()=>{
 const {projectId,employeeId,dates}=k104Correction;
 const attendance={[employeeId]:Object.fromEntries(dates.map(date=>[date,{obraId:projectId,status:'P',ot:0}]))};
 const data={obras:[{id:projectId,name:'K1-04'}],attendance,transacoes:[],payments:[],despesasEmpresa:[]};
 const before={localOnly:true,companyId:'arcd',sourceHash:'original',revision:1,data:structuredClone(data),tables:{company_app_data:[{company_id:'arcd',key:'arced_ponto_v1',value:structuredClone(data)},{company_id:'arcd',key:'arced_ponto_v1__ponto__obra__'+projectId,value:{attendance:structuredClone(attendance)}},{company_id:'arcd',key:'arced_auth_profiles_v1',value:{usuarios:[]}}],financial_titles:[]},receipts:[{kind:'cleanup'}]};
 const snapshot={tables:structuredClone(before.tables)};
 for(const row of snapshot.tables.company_app_data)for(const date of dates)if(row.value.attendance)row.value.attendance[employeeId][date].status='F';
 return {before,snapshot};
};
it('corrige somente as duas células em memória e nas duas cópias persistidas, sem refazer limpeza',()=>{
 const {before,snapshot}=fixture(),original=structuredClone(before),source=structuredClone(snapshot),state=reconcileK104Attendance(before,snapshot,'2026-11-18T22:00:00Z');
 expect(before).toEqual(original);expect(snapshot).toEqual(source);expect(state.revision).toBe(2);expect(state.receipts).toHaveLength(2);
 for(const row of state.tables.company_app_data.slice(0,2))for(const date of k104Correction.dates)expect(decodeAppData(row.value).attendance[k104Correction.employeeId][date].status).toBe('F');
 expect(state.tables.company_app_data[2]).toEqual(before.tables.company_app_data[2]);expect(state.tables.financial_titles).toEqual([]);
 expect(state.data.payments).toEqual([]);expect(state.data.transacoes).toEqual([]);
 expect(reconciliationHash(state)).toBe(reconciliationHash(reconcileK104Attendance(before,snapshot,'2026-11-18T22:00:00Z')));
 expect(()=>reconcileK104Attendance(state,snapshot,'2026-11-18T22:00:00Z')).toThrow('revisão 1');
});
it('recusa outra empresa, outra obra e revisão fora da cópia limpa',()=>{
 for(const change of [before=>{before.companyId='mrc';},before=>{before.data.obras[0].id='other';},before=>{before.revision=0;}]){
  const {before,snapshot}=fixture();change(before);expect(()=>reconcileK104Attendance(before,snapshot,'2026-11-18T22:00:00Z')).toThrow();
 }
});
it('recusa origem sem a correção ou com valores adicionais modificados',()=>{
 for(const status of ['P','F']){
  const {before,snapshot}=fixture();
  for(const row of snapshot.tables.company_app_data.slice(0,2))Object.assign(row.value.attendance[k104Correction.employeeId][k104Correction.dates[0]],{status,ot:status==='F'?1:0});
  expect(()=>reconcileK104Attendance(before,snapshot,'2026-11-18T22:00:00Z')).toThrow();
 }
});
it('recusa divergência na cópia persistida, sem modificar a entrada',()=>{
 const {before,snapshot}=fixture();before.tables.company_app_data[1].value.attendance[k104Correction.employeeId][k104Correction.dates[1]].status='F';const original=structuredClone(before);
 expect(()=>reconcileK104Attendance(before,snapshot,'2026-11-18T22:00:00Z')).toThrow('persistida');expect(before).toEqual(original);
});
