import {expect,it} from 'vitest';
import {assertCompanyProjectScope} from './company-project-guard.js';
const projects={k:'mrc',i:'mrc',a:'arcd'};
it('bloqueia referências de outra empresa em comandos, bases antigas e cadastro de obra',()=>{
  for(const payload of [{command:{payload:{obraId:'k'}}},{basePayload:{obras:[{id:'k'}]}},{sections:{employees:[{id:'e',obra:'k'}]}},{filters:{workId:'i'}}]){
    expect(()=>assertCompanyProjectScope(payload,projects,'arcd')).toThrow('outra empresa');
  }
});
it('aceita o próprio escopo e novas identidades sem procurar nomes por semelhança',()=>{
  expect(()=>assertCompanyProjectScope({command:{payload:{obraId:'k'}}},projects,'mrc')).not.toThrow();
  expect(()=>assertCompanyProjectScope({obras:[{id:'new',name:'K1-10 semelhante'}]},projects,'arcd')).not.toThrow();
});
