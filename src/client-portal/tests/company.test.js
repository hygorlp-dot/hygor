import {afterEach,expect,it} from 'vitest';
import {portalApiUrl,portalNavigationPath} from '../company.js';
afterEach(()=>history.replaceState({},'','/'));
it('mantém a empresa MRC nas consultas, downloads e navegação do portal',()=>{
  history.replaceState({},'','/cliente?empresa=mrc');
  expect(portalApiUrl('/api/client/auth/session')).toBe('/api/client/auth/session?companyId=mrc');
  expect(portalApiUrl('/api/client/projects/k/statement?month=2026-11')).toBe('/api/client/projects/k/statement?month=2026-11&companyId=mrc');
  expect(portalNavigationPath('/cliente/obra/k')).toBe('/cliente/obra/k?empresa=mrc');
});
