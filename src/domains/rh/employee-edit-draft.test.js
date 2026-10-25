import {it,expect} from 'vitest';
import {employeeEditDraft} from './employee-edit-draft.js';
it('preserva valores zero e dados legados sem converter diária em salário',()=>{
  const source={id:'e',dailyRate:100,vtDaily:0,vrDaily:0,cpf:'preservar',startDate:'2026-03-20',version:7};
  const result=employeeEditDraft(source);
  expect(result).toMatchObject({dailyRate:'100',vtDaily:'0',vrDaily:'0',monthlySalary:'',remunerationMode:'daily',version:7,cpf:'preservar'});
  expect(source).not.toHaveProperty('monthlySalary');
});
it('reutiliza salário e identificação já salvos no perfil sem alterar sua origem',()=>{
  const source={monthlySalary:0,cltPayroll:{profile:{salary:2600,registration:'007',cbo:'715210',category:'professional'},drafts:{'2026-08':{confirmed:true}}}};
  const result=employeeEditDraft(source);expect(result.monthlySalary).toBe('2600');expect(result.cltPayroll).toEqual(source.cltPayroll);result.cltPayroll.profile.cbo='000000';expect(source.cltPayroll.profile.cbo).toBe('715210');
  expect(employeeEditDraft({...source,monthlySalary:3000}).monthlySalary).toBe('3000');
});
