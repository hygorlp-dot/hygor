import {EMPLOYEE_DOCUMENT_CATEGORIES} from './document-categories.js';
import {isCltPayrollOnDate} from './payroll-classification.js';
import {remunerationModeOnDate} from './remuneration-mode.js';
import {payModeRegistrationIssues} from './attendance-pay-mode.js';
import {employeeComplianceStatus} from './compliance.js';
import {validDate} from './date-validation.js';

// Checklist operacional de conferência, não uma declaração de exigência legal
// universal. Férias, afastamentos e desligamento dependem do evento correspondente.
export function employeeDossierStatus(employee,documents,asOf){
  const suggested=new Set(['identity','address','contract']);
  if(isCltPayrollOnDate(employee,asOf))for(const id of ['registration','aso'])suggested.add(id);
  if(employee.workArea!=='administrativo'&&(employee.obra||employee.workArea==='campo'))for(const id of ['training','ppe'])suggested.add(id);
  const categories=EMPLOYEE_DOCUMENT_CATEGORIES.map(([id,name])=>{
    const active=(documents||[]).filter(document=>document.category===id&&!document.archivedAt);
    const current=active.filter(document=>(!document.issuedAt||validDate(document.issuedAt)&&document.issuedAt<=asOf)&&(!document.expiresAt||validDate(document.expiresAt)&&document.expiresAt>=asOf));
    const missingExpiry=id==='aso'&&current.length>0&&!current.some(document=>validDate(document.expiresAt));
    const state=!active.length?'missing':missingExpiry?'validity_missing':current.length?'present':active.every(document=>validDate(document.issuedAt)&&document.issuedAt>asOf)?'future':'expired';
    const status={missing:'sem arquivo ativo',validity_missing:'validade do ASO não informada',present:'arquivo disponível para conferência',future:'emissão posterior à data consultada',expired:'arquivo vencido ou data inválida'}[state];
    return {id,name,state,status,activeCount:active.length,currentCount:current.length,suggested:suggested.has(id)};
  });
  const pending=categories.filter(category=>category.suggested&&category.state!=='present'||!category.suggested&&category.activeCount>0&&category.state!=='present');
  const registrationIssues=payModeRegistrationIssues(employee,remunerationModeOnDate(employee,asOf),asOf);
  if(!validDate(employee.birthDate))registrationIssues.push('Data de nascimento');
  const address=employee.address;
  if(!address||typeof address!=='object'||!['street','number','district','city','state','postalCode'].every(key=>String(address[key]||'').trim()))registrationIssues.push('Endereço completo');
  if(!employee.emergencyContact?.name?.trim()||!employee.emergencyContact?.phone?.trim())registrationIssues.push('Contato de emergência');
  for(const label of employeeComplianceStatus(employee,asOf).expired)registrationIssues.push(`${label} vencido no cadastro`);
  return {categories,pending,registrationIssues:[...new Set(registrationIssues)],suggestedCount:suggested.size,presentCount:categories.filter(category=>category.suggested&&category.state==='present').length};
}
