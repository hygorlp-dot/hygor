export const PAYROLL_HANDOFF_KEY='arcd_payroll_from_attendance';
export function readPayrollHandoff(){
  try{const value=JSON.parse(window.sessionStorage.getItem(PAYROLL_HANDOFF_KEY)||'null');return value&&['daily','clt'].includes(value.mode)&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value.competence)&&typeof value.employeeId==='string'?value:null;}catch{return null;}
}
