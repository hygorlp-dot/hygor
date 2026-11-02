import {payModeRegistrationIssues} from './attendance-pay-mode.js';
import {remunerationModeOnDate} from './remuneration-mode.js';
import {prepareMonthlyPayslip} from '../ponto/clt-preparation.js';
import {reviewMonthlyPayslip} from '../ponto/clt-closing.js';
import {calculateLaborProvision,newProvisionDraft} from '../ponto/labor-provisions.js';

export function payrollReadiness(data,employee,competence){
  if(!employee||!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence||''))return null;
  const end=new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).toISOString().slice(0,10);
  const mode=remunerationModeOnDate(employee,end);
  const provision=employee.laborProvisions?.[competence];
  const values=provision||newProvisionDraft(employee,competence);
  const reserve=calculateLaborProvision(values);
  const validSalary=value=>Number.isFinite(Number(value))&&Number(value)>0;
  const salary=validSalary(employee.monthlySalary)?employee.monthlySalary:validSalary(employee.cltPayroll?.profile?.salary)?employee.cltPayroll.profile.salary:undefined;
  const registration=payModeRegistrationIssues({...employee,monthlySalary:salary},mode,end);
  const prepared=mode==='clt'?prepareMonthlyPayslip(data,employee,competence,{advances:false}):null;
  const review=mode==='clt'?reviewMonthlyPayslip(data,employee,competence):null;
  const pointErrors=prepared?.point.errors||[];
  const pointRow=prepared?.point.rows.find(row=>(row.scheduled||row.record?.status)&&(!row.approved||row.scheduled&&!row.record?.status))||prepared?.point.rows.find(row=>row.scheduled);
  return {mode,pointDate:pointRow?.date||`${competence}-01`,pointObraId:pointRow?.obraId||'',steps:[
    {id:'registration',title:'Completar cadastro',status:registration.length?'Pendente':'Dados preenchidos',issues:registration,action:'Abrir cadastro'},
    {id:'point',title:'Conferir ponto',status:pointErrors.length?`${pointErrors.length} pendência(s)`:'Conferência do RH',issues:pointErrors.length?pointErrors:[mode==='mei'?'MEI usa a folha própria, sem apuração por ponto.':'Confira registros, justificativas e fechamentos; ausência de registro não é falta.'],action:'Abrir gestão do ponto'},
    {id:'payroll',title:mode==='clt'?'Concluir holerite CLT':'Conferir folha da quinzena',status:review?(review.errors.length?'Pendente':'Salvo e válido'):'Conferir na folha',issues:review?.errors||['Confira o ciclo, os apontamentos e os descontos antes de fechar. O atalho não aprova nem paga.'],action:mode==='clt'?'Abrir holerite':'Abrir folha'},
    {id:'provisions',title:'Revisar provisões',status:!values.included?'Não incluído':reserve.errors.length?'Dados pendentes':provision?'Estimativa salva':'Estimativa não salva',issues:!values.included?['Inclusão opcional para esta modalidade; informe uma base mensal se o RH decidir incluir.']:reserve.errors.length?reserve.errors:[...(!provision?['A base existente foi reaproveitada; revise e salve somente após conferir.']:[]),...(reserve.accumulated===null?['Saldo acumulado não apurado: informe abertura e utilização conhecidas, inclusive zero.']:[]),'Reserva mensal integral de planejamento; não representa pagamento nem apuração dos avos efetivos.'],action:'Abrir provisões'},
  ]};
}
