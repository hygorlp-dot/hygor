import {expect,it} from 'vitest';
import {calculateBudget,createBudgetRevision} from './calculations.js';
import {changeBudgetScopeExclusion} from './budget-pending.js';
import {budgetRevisionFamily,compareBudgetRevisions} from './budget-revision-comparison.js';

const item=(id,overrides={})=>({id,etapaId:'s',codigo:'001',fonte:'SINAPI',unidade:'M2',descricao:'Serviço',quantidade:10,precoUnit:100,...overrides});
const original=itens=>({id:'v1',versionId:'v1',obraId:'obra',versionNumber:1,versionStatus:'aprovado',lockedAt:'2026-11-18',bdi:10,etapas:[{id:'s',nome:'Fundação'}],itens});
const revise=(base,overrides={})=>({...createBudgetRevision(base,{id:'v2',versionId:'v2',now:'2026-11-19'}),...overrides});

it('decompõe alterações simultâneas na ordem declarada, reconciliando em centavos e preservando a aprovação',()=>{
  const base=original([item('a')]);
  const revision=revise(base,{bdi:20,itens:[item('a',{quantidade:12,precoUnit:110})]});
  const frozen=JSON.stringify(base);
  const result=compareBudgetRevisions(base,revision);
  expect(result.baseTotal).toBe(110000);
  expect(result.revisionTotal).toBe(158400);
  expect(result.totals).toEqual({quantity:22000,price:13200,bdi:13200,scope:0,unresolved:0});
  expect(result.delta).toBe(Object.values(result.totals).reduce((a,b)=>a+b,0));
  expect(JSON.stringify(base)).toBe(frozen);
});

it('separa entrada, retirada, mudança de unidade e exclusão sem inferir equivalência por descrição ou código',()=>{
  const pending=item('pending',{precoUnit:0});
  const base=original([item('remove'),item('change'),pending]);
  const excluded=changeBudgetScopeExclusion(pending,{exclude:true,reason:'Fora do contrato',actorId:'e',now:'2026-11-19'});
  const revision=revise(base,{itens:[item('new'),item('change',{unidade:'M3',precoUnit:200}),excluded]});
  const result=compareBudgetRevisions(base,revision);
  expect(result.rows.map(row=>row.kind)).toEqual(['removed','matched','matched','added']);
  expect(result.totals).toEqual({quantity:0,price:0,bdi:0,scope:110000,unresolved:0});
  expect(result.rows.find(row=>row.after[0]?.id==='pending')).toMatchObject({delta:0,changes:[{factor:'scope',label:'Excluído do escopo'}]});
});

it('trata identidades ausentes e duplicadas como pendências e mantém o total reconciliado',()=>{
  const base=original([item('dup'),item('dup'),item(undefined)]);
  const revision=revise(base,{itens:[item('dup',{quantidade:2}),item(undefined,{quantidade:0})]});
  const result=compareBudgetRevisions(base,revision);
  expect(result.rows).toHaveLength(2);
  expect(result.rows.every(row=>row.kind==='unresolved')).toBe(true);
  expect(result.totals.unresolved).toBe(calculateBudget(revision).totalCentavos-calculateBudget(base).totalCentavos);
});

it('distingue linhagem explícita, orçamentos soltos e versões com vínculo ambíguo',()=>{
  const base=original([]),next=revise(base),third=revise(next,{id:'v3',versionId:'v3',versionNumber:3});
  const branch=revise(base,{id:'v2b',versionId:'v2b'});
  const detached={...base,id:'solto',versionId:'solto'};
  const other=revise(base,{id:'outra',versionId:'outra',obraId:'outra'});
  expect(budgetRevisionFamily([base,next,third,branch,detached,other],next).map(row=>row.id)).toEqual(['v1','v2','v2b','v3']);
  expect(budgetRevisionFamily([base,next,{...base,id:'id-repetido'}],next)).toEqual([next]);
  expect(budgetRevisionFamily([detached,next],next)).toEqual([next]);
  expect(compareBudgetRevisions(base,other).error).toContain('mesma obra');
});
