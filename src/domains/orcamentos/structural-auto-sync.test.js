import { expect, it } from 'vitest';
import { syncStructuralQuantities, undoStructuralChange, auditStructuralLinks } from './structural-auto-sync';
import { suggestedStructuralTarget } from './structural-budget-matching';
import { reconcileOptimisticSnapshot } from '../sync/optimistic-merge';

const base=()=>({id:'budget',etapas:[{id:'v',nome:'1º pavimento · Vigas'}],itens:[
  {id:'c',etapaId:'v',descricao:'Concretagem de vigas',unidade:'M3',quantidade:2,precoUnit:100},
  {id:'f',etapaId:'v',descricao:'Fôrma de vigas',unidade:'M2',quantidade:10,precoUnit:20},
],memoriaCalculo:{pavimento1:{viga:{concretoM3:2,formaM2:10}},vinculosEstruturais:{'pavimento1-vigas.concreto':'c','pavimento1-vigas.forma':'f'}}});

it('salva medida e quantidade juntas, permite zero explícito e não duplica reaplicações',()=>{
  const before=base(), next=structuredClone(before);
  next.memoriaCalculo.pavimento1.viga.concretoM3=3;
  next.memoriaCalculo.pavimento1.viga.formaM2=0;
  const result=syncStructuralQuantities(before,next);
  expect(result.budget.itens.map(i=>i.quantidade)).toEqual([3,0]);
  expect(result.changes.map(c=>[c.before,c.after])).toEqual([[2,3],[10,0]]);
  expect(before.itens[0].quantidade).toBe(2);
  expect(syncStructuralQuantities(result.budget,result.budget).changes).toEqual([]);
});
it('preserva destino inválido sem impedir o válido e distingue vazio de zero',()=>{
  const before=base(), next=structuredClone(before);
  next.memoriaCalculo.pavimento1.viga.concretoM3='';
  next.memoriaCalculo.pavimento1.viga.formaM2=12;
  const result=syncStructuralQuantities(before,next);
  expect(result.budget.itens.map(i=>i.quantidade)).toEqual([2,12]);
  expect(result.issues[0].message).toContain('ausente');
  expect(auditStructuralLinks(result.budget)[0].message).toContain('ausente');
});
it('troca destino e retira a parcela anterior sem duplicação',()=>{
  let before=syncStructuralQuantities(base(),base()).budget;
  const next=structuredClone(before);
  next.itens.push({...next.itens[0],id:'new',quantidade:0});
  next.memoriaCalculo.vinculosEstruturais['pavimento1-vigas.concreto']='new';
  const result=syncStructuralQuantities(before,next);
  expect(result.budget.itens.map(i=>i.quantidade)).toEqual([0,10,2]);
});
it('desfaz memória e quantidades, preservando preço atualizado e recusando alteração posterior de medida',()=>{
  const before=base(), next=structuredClone(before);
  next.memoriaCalculo.pavimento1.viga.concretoM3=3;
  const result=syncStructuralQuantities(before,next);
  const receipt={budgetId:before.id,beforeMemory:before.memoriaCalculo,afterMemory:result.budget.memoriaCalculo,changes:result.changes};
  const current=structuredClone(result.budget);
  current.itens[0].precoUnit=150;
  expect(undoStructuralChange(current,receipt).itens[0]).toMatchObject({quantidade:2,precoUnit:150});
  current.memoriaCalculo.pavimento1.viga.concretoM3=4;
  expect(()=>undoStructuralChange(current,receipt)).toThrow('posteriores');
});
it('não altera orçamento aprovado nem aplica unidades inválidas',()=>{
  const before={...base(),versionStatus:'aprovado'};
  expect(syncStructuralQuantities(before,base()).budget).toBe(before);
  const next=base();next.itens[0].unidade='KG';
  expect(syncStructuralQuantities(base(),next).issues[0].message).toContain('incompatível');
});
it('sugere só quando pavimento, elemento, serviço e unidade apontam um único destino',()=>{
  const row={key:'concreto',unit:'m³'};
  const candidate={...base().itens[0],stagePath:'1º PAVIMENTO › VIGAS'};
  expect(suggestedStructuralTarget('pavimento1-vigas',row,base(),[candidate])).toBe(candidate);
  expect(suggestedStructuralTarget('terreo-vigas',row,base(),[candidate])).toBeNull();
  expect(suggestedStructuralTarget('pavimento1-vigas',row,base(),[candidate,{...candidate,id:'other'}])).toBeNull();
});

it('recalcula com as duas medidas mais recentes em edições rápidas do lastro',()=>{
  const before={itens:[{id:'m',descricao:'Concreto magro para lastro',unidade:'M3',quantidade:.3}],memoriaCalculo:{terreo:{viga:{areaPlantaVigasM2:10,larguraVigaM:1,magroLarguraAcrescidaM:0,magroEspessuraCm:3}},vinculosEstruturais:{'terreo-vigas.magro':'m'}}};
  const first=structuredClone(before);first.memoriaCalculo.terreo.viga.areaPlantaVigasM2=20;
  const latest=syncStructuralQuantities(before,first).budget;
  const second=structuredClone(before);second.memoriaCalculo.terreo.viga.magroEspessuraCm=5;
  const merged=reconcileOptimisticSnapshot({latest,rendered:before,intended:second});
  expect(syncStructuralQuantities(latest,merged).budget.itens[0].quantidade).toBe(1);
});

it('atualiza a partir do quadro-resumo e mantém preço e composição',()=>{
  const before=base(), next=structuredClone(before);
  next.memoriaCalculo.resumosProjeto={pavimento1:{viga:{concretoM3:4,formaM2:20}}};
  const result=syncStructuralQuantities(before,next);
  expect(result.budget.itens[0]).toMatchObject({quantidade:4,precoUnit:100});
  expect(result.budget.itens[1]).toMatchObject({quantidade:20,precoUnit:20});
  expect(auditStructuralLinks(result.budget)).toEqual([]);
});
