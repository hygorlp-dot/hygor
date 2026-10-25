import {it,expect} from 'vitest';
import {effectiveEmployeeOnDate} from './remuneration-values.js';
import {applyEmployeeCommand} from './employee-commands.js';
import {calculateAttendanceDayCost} from '../ponto/payroll.js';
it('editar dados pessoais não confunde defaults antigos e salário já salvo no perfil com reajuste',()=>{
  const old={id:'e',name:'QA',startDate:'2026-03-20',dailyRate:100,version:1,cltPayroll:{profile:{salary:2600}}};
  const result=applyEmployeeCommand({employees:[old]}, {type:'FUNCIONARIO_SALVO',actorId:'rh',expectedVersion:1,payload:{employee:{...old,phone:'81999999999',monthlySalary:2600,workdayHours:8,overtimeAdditionalPercent:50,workStart:'07:00'}}});
  expect(result.ok).toBe(true);expect(result.data.employees[0].remunerationValuesHistory).toEqual([]);
});
it('mudança de início da jornada exige vigência e preserva o horário anterior',()=>{
  const old={id:'e',name:'QA',startDate:'2026-03-20',dailyRate:100,version:1,workStart:'07:00'};
  const command={type:'FUNCIONARIO_SALVO',actorId:'rh',expectedVersion:1,payload:{employee:{...old,workStart:'08:00'}}};
  expect(applyEmployeeCommand({employees:[old]},command).ok).toBe(false);
  Object.assign(command.payload.employee,{remunerationValueEffectiveFrom:'2026-10-01',remunerationValueReason:'Jornada alterada pelo RH'});
  const result=applyEmployeeCommand({employees:[old]},command);expect(result.ok).toBe(true);
  expect(effectiveEmployeeOnDate(result.data.employees[0],'2026-09-30').workStart).toBe('07:00');
  expect(effectiveEmployeeOnDate(result.data.employees[0],'2026-10-01').workStart).toBe('08:00');
});
it('reajuste com vigência preserva custo anterior e o histórico pertence ao servidor',()=>{
  const old={id:'e',name:'QA',startDate:'2026-03-20',dailyRate:100,workdayHours:8,version:1,active:true};
  const data={employees:[old],obras:[],quinzenasArquivadas:{q:{fim:'2026-09-20'}}};
  const command={type:'FUNCIONARIO_SALVO',actorId:'rh',expectedVersion:1,payload:{employee:{...old,dailyRate:120,remunerationValueEffectiveFrom:'2026-09-21',remunerationValueReason:'Reajuste contratual registrado',remunerationValuesHistory:[{date:'2026-01-01',dailyRate:1}]}}};
  const result=applyEmployeeCommand(data,command,'2026-09-21T12:00:00Z');expect(result.ok).toBe(true);const employee=result.data.employees[0];
  expect(effectiveEmployeeOnDate(employee,'2026-09-20').dailyRate).toBe(100);expect(effectiveEmployeeOnDate(employee,'2026-09-21').dailyRate).toBe(120);
  expect(calculateAttendanceDayCost({employee,record:{status:'P'},date:'2026-09-20'}).laborCost).toBe(100);
  expect(calculateAttendanceDayCost({employee,record:{status:'P'},date:'2026-09-21'}).laborCost).toBe(120);
  expect(calculateAttendanceDayCost({employee,record:{status:'P',archivedDailyRate:80},date:'2026-09-21'}).laborCost).toBe(80);
  expect(employee.remunerationValuesHistory.some(r=>r.dailyRate===1)).toBe(false);
});
