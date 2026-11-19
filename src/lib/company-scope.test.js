import {afterEach,expect,it} from 'vitest';
import {activeCompany,companyStorageKey,setActiveCompany,setCompanyIsolation} from './company-scope.js';
import {sessionContext} from './session-context.js';
import {setWorkContextObra,workContextObraId} from '../features/workflow/work-context.js';
afterEach(()=>{setActiveCompany('arcd');setCompanyIsolation(false);sessionStorage.clear();});
it('mantém navegação e filtros separados inclusive para o mesmo administrador',()=>{
  setCompanyIsolation(true);sessionContext.setItem('obra','a');const arcd=companyStorageKey('obra');
  setActiveCompany('mrc');expect(activeCompany()).toBe('mrc');expect(sessionContext.getItem('obra')).toBeNull();
  sessionContext.setItem('obra','k');expect(companyStorageKey('obra')).not.toBe(arcd);
  setActiveCompany('arcd');expect(sessionContext.getItem('obra')).toBe('a');
});
it('não conserva em memória a obra em foco da empresa anterior',()=>{
  setCompanyIsolation(true);setWorkContextObra('a');
  setActiveCompany('mrc');expect(workContextObraId()).toBe('');setWorkContextObra('k');
  setActiveCompany('arcd');expect(workContextObraId()).toBe('a');
});
