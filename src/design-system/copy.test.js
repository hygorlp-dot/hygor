import {describe,it,expect} from 'vitest';
import {contar,contarDecimal} from './copy.js';

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

describe('contarDecimal',()=>{
  it('mantém meio período em vírgula e não arredonda',()=>{
    expect(contarDecimal(10.5,'dia equivalente','dias equivalentes')).toBe('10,5 dias equivalentes');
    expect(contarDecimal(1,'dia','dias')).toBe('1 dia');
    expect(contarDecimal(0.5,'dia','dias')).toBe('0,5 dia');
    expect(contarDecimal(12,'dia','dias')).toBe('12 dias');
  });
  it('texto já formatado não é quantidade: a regra é passar o número',()=>{
    // "10,5" vira NaN em Number(); por isso FolhaView passa v.presentes+v.meiodia*0.5, não a string.
    expect(contarDecimal('10,5','dia','dias')).toBe('0 dias');
  });
});
