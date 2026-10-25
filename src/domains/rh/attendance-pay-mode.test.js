import {it,expect} from 'vitest';
import {applyEmployeeCommand,EMPLOYEE_COMMAND} from './employee-commands.js';
import {validateOperationalCommandScope} from '../../../server/operational-command-policy.js';
import {remunerationModeOnDate} from './remuneration-mode.js';
const employee={id:'e',name:'Operário QA',cpf:'529.982.247-25',phone:'81999999999',role:'Pedreiro',obra:'o',startDate:'2026-05-01',active:true,dailyRate:120,monthlySalary:2406.8,workdayHours:8,workStart:'07:00',pixType:'CPF',pixKey:'52998224725',pixHolder:'Operário QA',examExpiresAt:'2027-05-01',remunerationMode:'daily',version:1,cltPayroll:{profile:{registration:'001',cbo:'715210',category:'professional'}}};
const base=()=>({employees:[structuredClone(employee)],obras:[{id:'o',name:'Obra'}],financialSettlements:[{id:'real',amount:7160}]});
const command={type:EMPLOYEE_COMMAND.EMPLOYEE_PAY_MODE_SET,expectedVersion:1,actorId:'rh',actorName:'RH',payload:{employeeId:'e',mode:'clt',effectiveFrom:'2026-10-01',reason:'Contrato mensal formalizado'}};
it('define pelo ponto com vigência, histórico e sem modificar pagamentos',()=>{
  const result=applyEmployeeCommand(base(),command,'2026-09-30T12:00:00Z');expect(result.ok).toBe(true);
  const saved=result.data.employees[0];expect(remunerationModeOnDate(saved,'2026-09-30')).toBe('daily');expect(remunerationModeOnDate(saved,'2026-10-01')).toBe('clt');expect(saved.payModeDecisions[0]).toMatchObject({source:'attendance',changedBy:'rh'});expect(result.data.financialSettlements).toEqual([{id:'real',amount:7160}]);
});
it('bloqueia cadastro incompleto no servidor e não altera folhas fechadas',()=>{
  const data=base();data.employees[0].cpf='000';expect(applyEmployeeCommand(data,command).reason).toContain('CPF válido');
  const closed=base();closed.quinzenasArquivadas={'2026-10-Q1':{fim:'2026-10-20'}};expect(applyEmployeeCommand(closed,command).reason).toContain('folhas fechadas');
  expect(applyEmployeeCommand(base(),{...command,expectedVersion:0}).ok).toBe(false);
});
it('mantém a escolha real restrita ao RH/admin',()=>{
  const data=base();expect(validateOperationalCommandScope({data,user:{id:'f',role:'financeiro'},command}).ok).toBe(false);
});

