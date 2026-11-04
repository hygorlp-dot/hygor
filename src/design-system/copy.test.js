import {describe,it,expect} from 'vitest';
import {contar} from './copy.js';

describe('contar',()=>{
  it('usa singular só para um e plural para o resto',()=>{
    expect(contar(1,'crítica','críticas')).toBe('1 crítica');
    expect(contar(3,'crítica','críticas')).toBe('3 críticas');
    expect(contar(0,'ação','ações')).toBe('0 ações');
  });
  it('formata milhares e trata ausência como zero',()=>{
    expect(contar(1250,'item','itens')).toBe('1.250 itens');
    expect(contar(undefined,'título','títulos')).toBe('0 títulos');
  });
});
