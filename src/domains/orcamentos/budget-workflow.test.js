import { expect,it } from 'vitest';
import { budgetChangeReceipt,undoBudgetChange,repositionBudgetItem,auditWholeBudget } from './budget-workflow';
import { updateBudgetFloor,reconcileBudgetFloors,memoryFloors } from './budget-floors';
import { buildBudgetTree } from './tree';
import {budgetCompletion,changeBudgetScopeExclusion} from './budget-pending.js';
import {calculateBudget} from './calculations.js';

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

it('localiza preço pendente e divergência da composição gravada, inclusive em item zerado',()=>{
  const service={etapaId:'s',unidade:'UN',quantidade:1};
  const composicao=JSON.stringify([{coeficiente:'9',precoUnit:23.48},{coeficiente:1,precoUnit:678.6}]);
  const budget={etapas:[{id:'s'}],itens:[
    {...service,id:'laje',precoUnit:0},
    {...service,id:'camera',quantidade:0,precoUnit:583.51,composicao},
    {...service,id:'coerente',precoUnit:889.924,composicao},
    {...service,id:'nota',precoUnit:100,composicao:'Confirmar com o fornecedor'},
    {...service,id:'incompleta',precoUnit:100,composicao:'[{"coeficiente":1,"precoUnit":null}]'},
    {...service,id:'titulo',tipo:'titulo'},
  ]};
  const issues=auditWholeBudget(budget).filter(i=>i.id.endsWith(':cost'));
  expect(issues.map(i=>i.itemId)).toEqual(['laje','camera']);
  expect(issues[0]).toMatchObject({destination:'budget',stageId:'s',message:expect.stringContaining('Preço unitário pendente')});
  expect(issues[1].message).toMatch(/583,51.*889,92/);
});

it('documenta exclusão de item pendente sem mudar centavos e reabre ao reincluir ou editar a linha',()=>{
  const item={id:'pendente',etapaId:'s',descricao:'Laje',unidade:'M2',quantidade:10,precoUnit:0};
  const valued={...item,id:'precificado',precoUnit:100};
  const options={exclude:true,reason:'Fora do contrato',actorId:'eng',actorName:'Engenharia',now:'2026-11-19T12:00:00Z'};
  expect(()=>changeBudgetScopeExclusion(item,{...options,reason:' '})).toThrow('Informe um motivo');
  expect(()=>changeBudgetScopeExclusion(valued,options)).toThrow('pendência');
  const excluded=changeBudgetScopeExclusion(item,options);
  const budget={etapas:[{id:'s'}],itens:[excluded,valued],bdi:22.12};
  expect(budgetCompletion(budget)).toMatchObject({partial:false,quote:0,excluded:[{exclusion:{motivo:options.reason,autorId:'eng'}}]});
  expect(auditWholeBudget(budget)).toContainEqual(expect.objectContaining({itemId:item.id,kind:'excluded'}));
  expect(calculateBudget(budget).totalCentavos).toBe(calculateBudget({...budget,itens:[item,valued]}).totalCentavos);
  expect(budgetCompletion({...budget,itens:[{...excluded,quantidade:20}]})).toMatchObject({partial:true,quote:1});
  expect(budgetCompletion({...budget,itens:[changeBudgetScopeExclusion(excluded,{exclude:false})]})).toMatchObject({partial:true,quote:1});
});
