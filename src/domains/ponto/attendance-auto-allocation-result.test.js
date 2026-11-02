// @vitest-environment node
import {it,expect} from 'vitest';
import {applyAttendanceServerResult} from './attendance-mutations.js';
it('reaproveita alteração autoritativa sem perder cadastro nem reverter versão mais nova',()=>{
 const data={employees:[{id:'e',obra:'a',version:2,monthlySalary:2400,cpf:'preservado'}],payments:[{amount:100}]};
 const employeeAllocations=[{employeeId:'e',obraId:'b',version:3,updatedAt:'2026-11-01T12:00:00Z',historyEntry:{id:'auto',date:'2026-11-01',fromObraId:'a',toObraId:'b'}}];
 const next=applyAttendanceServerResult(data,{employeeAllocations});
 expect(next.employees[0]).toMatchObject({obra:'b',version:3,cpf:'preservado',monthlySalary:2400});
 expect(next.payments).toBe(data.payments);expect(data.employees[0].obra).toBe('a');
 expect(applyAttendanceServerResult(next,{employeeAllocations}).employees[0].obraHistory).toHaveLength(1);
 const newer={...next,employees:[{...next.employees[0],version:4,obra:'c'}]};
 expect(applyAttendanceServerResult(newer,{employeeAllocations}).employees[0].obra).toBe('c');
});
