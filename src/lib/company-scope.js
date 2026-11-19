export const COMPANY_OPTIONS=Object.freeze([{value:'arcd',label:'ARCD'},{value:'mrc',label:'MRC'}]);
let companyId='arcd';
let enabled=false;
try{
  const saved=JSON.parse(globalThis.sessionStorage?.getItem('arcd_auth_session')||'{}');
  const requested=new URLSearchParams(globalThis.location?.search||'').get('empresa');
  const value=saved.companyId||requested;
  if(COMPANY_OPTIONS.some(company=>company.value===value))companyId=value;
}catch{ /* A empresa é validada novamente pelo servidor. */ }
export const activeCompany=()=>companyId;
export const setCompanyIsolation=value=>{enabled=Boolean(value);};
export const companyIsolationActive=()=>enabled;
export function setActiveCompany(value){
  if(!COMPANY_OPTIONS.some(company=>company.value===value))throw new Error('Empresa inválida.');
  companyId=value;
}
export const companyStorageKey=key=>enabled||companyId!=='arcd'?`marcell:${activeCompany()}:${key}`:key;
