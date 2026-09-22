import { expect,it } from 'vitest';
import { budgetChangeReceipt,undoBudgetChange,repositionBudgetItem,auditWholeBudget } from './budget-workflow';
import { updateBudgetFloor,reconcileBudgetFloors,memoryFloors } from './budget-floors';
import { buildBudgetTree } from './tree';

it('desfaz reordenação, cópia e edição em uma operação sem perder campo alheio',()=>{
  const before={id:'b',etapas:[{id:'a'},{id:'b'}],itens:[{id:'i',quantidade:2}]};
  const after={...before,etapas:[before.etapas[1],before.etapas[0],{id:'novo'}],itens:[{id:'i',quantidade:4}]};
  const receipt=budgetChangeReceipt(before,after);
  expect(undoBudgetChange({...after,nota:'externa'},receipt)).toEqual({...before,nota:'externa'});
  expect(()=>undoBudgetChange({...after,itens:[{id:'i',quantidade:5}]},receipt)).toThrow('posteriores');
  expect(()=>undoBudgetChange({...after,versionStatus:'aprovado'},receipt)).toThrow();
});
it('move item para baixo, por posição e entre etapas mantendo IDs',()=>{
  const items=[{id:'a',etapaId:'s'},{id:'other',etapaId:'t'},{id:'b',etapaId:'s'},{id:'c',etapaId:'s'}];
  expect(repositionBudgetItem(items,'a',2).map(i=>i.id)).toEqual(['b','other','a','c']);
  expect(repositionBudgetItem(items,'a',1,'t').filter(i=>i.etapaId==='t').map(i=>i.id)).toEqual(['a','other']);
  expect(()=>repositionBudgetItem(items,'a',0)).toThrow();
  expect(items[0].etapaId).toBe('s');
});
it('compartilha nome, nível e identidade entre planilha e memorial',()=>{
  const budget={etapas:[{id:'s',nome:'Térreo'}],itens:[],memoriaCalculo:{}};
  const saved=updateBudgetFloor(budget,'terreo',{nome:'Pavimento de acesso',nivelM:'-1,20',etapaId:'s'});
  expect(saved.etapas[0]).toMatchObject({nome:'Pavimento de acesso',nivelM:-1.2,pavimentoId:'terreo'});
  const renamed=reconcileBudgetFloors({...saved,etapas:[{...saved.etapas[0],nome:'Acesso principal'}]});
  expect(memoryFloors(renamed.memoriaCalculo)[0].nome).toBe('Acesso principal');
  expect(buildBudgetTree(renamed.etapas,[])[0].id).toBe('s');
  expect(()=>updateBudgetFloor(saved,'pavimento1',{nome:'Primeiro',nivelM:3,etapaId:'s'})).toThrow('outro pavimento');
});
it('associa legado somente com nome inequívoco e não inventa nível',()=>{
  const one=reconcileBudgetFloors({etapas:[{id:'s',nome:'(SUPRAESTRUTURA) COBERTURA'}]});
  expect(memoryFloors(one.memoriaCalculo).find(f=>f.id==='cobertura')).toMatchObject({etapaId:'s',nivelM:undefined});
  const ambiguous=reconcileBudgetFloors({etapas:[{id:'a',nome:'Térreo'},{id:'b',nome:'Térreo'}]});
  expect(ambiguous.memoriaCalculo.cadastroPavimentos.terreo).toBeUndefined();
});
it('confere todos os itens, inclusive não estruturais e fora de etapas',()=>{
  const issues=auditWholeBudget({etapas:[{id:'s'}],itens:[{id:'p',etapaId:'s',descricao:'Pintura',quantidade:0,unidade:'M2'},{id:'o',etapaId:'missing',descricao:'Outro',quantidade:''}],memoriaCalculo:{vinculosEstruturais:{'pavimento1-vigas.aco-99':'p'}}});
  expect(issues.some(i=>i.itemId==='p'&&i.message.includes('zerada'))).toBe(true);
  expect(issues.some(i=>i.itemId==='o'&&i.message.includes('não informado'))).toBe(true);
  expect(issues.some(i=>i.itemId==='o'&&i.message.includes('etapa válida'))).toBe(true);
  expect(issues.some(i=>i.source==='pavimento1-vigas.aco-99')).toBe(true);
  expect(auditWholeBudget({memoriaCalculo:{terreo:{pilar:{concretoM3:-2}}}}).some(i=>i.message.includes('memorial inválido'))).toBe(true);
});
