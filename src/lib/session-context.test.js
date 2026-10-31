import {afterEach,describe,expect,it,vi} from 'vitest';
import {sessionContext} from './session-context.js';
afterEach(()=>vi.unstubAllGlobals());
describe('contexto opcional de navegação',()=>{
  it('preserva o handoff em memória quando o navegador bloqueia storage',()=>{
    vi.stubGlobal('sessionStorage',{getItem(){throw new Error('SecurityError');},setItem(){throw new Error('QuotaExceededError');},removeItem(){throw new Error('SecurityError');}});
    expect(sessionContext.getItem('blocked-work')).toBeNull();
    sessionContext.setItem('blocked-work','obra-1');expect(sessionContext.getItem('blocked-work')).toBe('obra-1');
    sessionContext.removeItem('blocked-work');expect(sessionContext.getItem('blocked-work')).toBeNull();
  });
  it('respeita a remoção externa de um contexto persistido',()=>{
    const values=new Map();vi.stubGlobal('sessionStorage',{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)});
    sessionContext.setItem('normal-work','obra-2');expect(values.get('normal-work')).toBe('obra-2');
    values.clear();expect(sessionContext.getItem('normal-work')).toBeNull();
  });
});
