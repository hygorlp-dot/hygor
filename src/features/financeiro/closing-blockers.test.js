import {describe,it,expect} from 'vitest';
import {closingBlocker} from './closing-blockers.js';

const data={obras:[{id:'a',name:'Obra A'},{id:'b',name:'Obra B'}],medicoes:[
 {id:'m1',obraId:'a',numero:'MED-001',valorPrevisto:100,competencia:'2026-09'},
 {id:'m2',obraId:'b',numero:'MED-002',valorPrevisto:100,competencia:'2026-10'},
]};
describe('orientação dos bloqueios de fechamento',()=>{
 it('reutiliza a origem por identificador, mesmo em competência anterior, sem transformar a diferença em valor do documento',()=>{
  const before=structuredClone(data);
  const result=closingBlocker(data,{code:'RECEIVABLE_OVERPAID',sourceType:'medicao',sourceId:'m1',obraId:'a',differenceCents:2500});
  expect(result.title).toBe('Recebimentos acima do valor a receber');
  expect(result.origin.record).toBe(data.medicoes[0]);
  expect(result.origin.amountCents).toBe(10000);
  expect(result.differenceCents).toBe(2500);
  expect(result.origin.obra).toBe('Obra A');
  expect(data).toEqual(before);
 });
 it.each([{sourceId:'ausente',obraId:'a'},{sourceId:'m1',obraId:'b'},{sourceId:'',obraId:'a'}])('não liga registro por nome, valor ou obra incompatível: %j',ids=>{
  expect(closingBlocker(data,{code:'RECEIVABLE_OVERPAID',sourceType:'medicao',...ids}).origin).toBeNull();
 });
 it('distingue o resumo de recebimentos dos avisos por documento e não inventa uma origem',()=>{
  const result=closingBlocker(data,{code:'RECEIVABLE_NON_NEGATIVE',expectedCents:0,actualCents:2500,differenceCents:2500});
  expect(result.title).toBe('Saldo a receber inconsistente');
  expect(result.reason).toContain('resumir diferenças');
  expect(result.origin).toBeNull();
 });
 it('mantém código desconhecido no diagnóstico sem apresentá-lo como instrução nem tratar contagem como dinheiro',()=>{
  const result=closingBlocker(data,{code:'UNIQUE_EVENT_IDS',differenceCents:2});
  expect(result.title).toBe('Conferência financeira necessária');
  expect(result.diagnostic).toBe('UNIQUE_EVENT_IDS');
  expect(result.differenceCents).toBeNull();
 });
 it('orienta obrigações e diferenças de total sem alterar as regras do motor',()=>{
  expect(closingBlocker(data,{code:'PAYABLE_OVERPAID'}).next).toContain('Pagamentos');
  expect(closingBlocker(data,{code:'DRE_RESULT_EQUATION',differenceCents:Infinity}).differenceCents).toBeNull();
  expect(closingBlocker(data,{code:'DRE_RESULT_EQUATION'}).next).toContain('DRE');
 });
});
