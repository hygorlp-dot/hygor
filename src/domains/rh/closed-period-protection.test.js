import {it,expect} from 'vitest';
import {applyEmployeeCommand} from './employee-commands.js';
const employee={id:'e',name:'QA',startDate:'2026-03-20',dailyRate:100,monthlySalary:0,remunerationMode:'daily',workdayHours:8,active:true,version:1};
const data=()=>({employees:[employee],quinzenasArquivadas:{'2026-09-Q2':{fim:'2026-10-05'}},pagamentosFolha:[{id:'real',valor:1000}],obras:[]});
const command=patch=>({type:'FUNCIONARIO_SALVO',actorId:'rh',expectedVersion:1,payload:{employee:{...employee,...patch}}});
it('cadastro geral não contorna vigência de modalidade em período fechado',()=>{
  expect(applyEmployeeCommand(data(),command({remunerationMode:'clt',monthlySalary:2406.8,remunerationEffectiveFrom:'2026-09-01'})).reason).toContain('folhas fechadas');
});
it('mantém cadastro não financeiro editável e impede reprecificar períodos pagos',()=>{
  const source=data(),result=applyEmployeeCommand(source,command({phone:'81999999999'}));expect(result.ok).toBe(true);expect(result.data.pagamentosFolha).toEqual(source.pagamentosFolha);
  expect(applyEmployeeCommand(source,command({dailyRate:120})).reason).toContain('reajuste com vigência');
  expect(applyEmployeeCommand(source,command({startDate:'2026-01-01'})).reason).toContain('períodos fechados');
});
it('fechamento financeiro também impede reajuste retroativo sem título ou arquivo',()=>{
  const source={employees:[employee],fechamentosFinanceiros:[{status:'fechado',dataInicio:'2026-09-01',dataFim:'2026-09-30'}]};
  const patch={dailyRate:120,remunerationValueEffectiveFrom:'2026-09-21',remunerationValueReason:'Reajuste contratual autorizado'};
  expect(applyEmployeeCommand(source,command(patch)).ok).toBe(false);
  expect(applyEmployeeCommand(source,command({...patch,remunerationValueEffectiveFrom:'2026-10-01'})).ok).toBe(true);
  expect(applyEmployeeCommand(source,command({phone:'81999999999'})).ok).toBe(true);
});
it('não permite retirar custo histórico por desligamento ou reativação retroativos',()=>{
  const source={employees:[employee],titulosFolha:[{id:'real',employeeId:'e',periodoFim:'2026-10-05',liquido:100,valorPago:100}],pagamentosFolha:[{id:'paid',valor:100}]};
  const snapshot=structuredClone(source);expect(applyEmployeeCommand(source,command({active:false,endDate:'2026-09-01'})).reason).toContain('período fechado');expect(source).toEqual(snapshot);
  const old={...employee,active:false,endDate:'2026-09-01'};
  expect(applyEmployeeCommand({...source,employees:[old]},command({active:true,endDate:''})).ok).toBe(false);
  expect(applyEmployeeCommand(source,command({status:'desligamento_agendado',endDate:'2026-11-01'})).ok).toBe(true);
});
it.each(['financial','title','archive'])('preserva holerite histórico fechado por %s, inclusive remoção pelo cadastro',kind=>{
  const old={...employee,cltPayroll:{drafts:{'2026-09':{competence:'2026-09',confirmed:true,salary:2406.8}}}};
  const source={employees:[old],...(kind==='financial'?{fechamentosFinanceiros:[{status:'fechado',dataInicio:'2026-09-01',dataFim:'2026-09-30'}]}:kind==='title'?{titulosFolha:[{id:'real',employeeId:'e',competencia:'2026-09',liquido:100,valorPago:100}]}:{quinzenasArquivadas:{'2026-09-Q2':{fim:'2026-10-05'}}})};
  const save=patch=>({...command({}),payload:{employee:{...old,...patch}}});
  const changed={...old.cltPayroll,drafts:{'2026-09':{...old.cltPayroll.drafts['2026-09'],salary:9999,confirmed:false}}};
  expect(applyEmployeeCommand(source,save({cltPayroll:changed})).ok).toBe(false);
  expect(applyEmployeeCommand(source,save({cltPayroll:{drafts:{}}})).ok).toBe(false);
  expect(applyEmployeeCommand(source,save({phone:'81999999999'})).ok).toBe(true);
});
it('rascunho de mês aberto continua editável pelo RH',()=>{
  const old={...employee,cltPayroll:{drafts:{'2026-11':{competence:'2026-11',confirmed:false,salary:2406.8}}}};
  const result=applyEmployeeCommand({employees:[old]}, {...command({}),payload:{employee:{...old,cltPayroll:{drafts:{'2026-11':{...old.cltPayroll.drafts['2026-11'],salary:2500}}}}}});
  expect(result.ok).toBe(true);
});
it('rescisão ativa protege vínculo até contra reativação fora do corte fechado',()=>{
  const source={employees:[employee],rescisoes:[{id:'r',empId:'e',status:'ativa'}]};
  expect(applyEmployeeCommand(source,command({active:false,endDate:'2026-11-01'})).reason).toContain('rescisão');
  source.rescisoes[0].status='cancelada';expect(applyEmployeeCommand(source,command({active:false,endDate:'2026-11-01'})).ok).toBe(true);
});
