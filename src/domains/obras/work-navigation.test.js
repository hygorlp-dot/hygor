import {describe,it,expect} from 'vitest';
import {workNavigationGroups,workNavigationTarget} from './work-navigation.js';

describe('destinos da obra',()=>{
 it('separa a cobrança do cliente do avanço físico',()=>{
  expect(workNavigationTarget('medicoes')).toMatchObject({id:'medicoes',global:true,label:'Medições a faturar'});
  expect(workNavigationTarget('med')).toMatchObject({id:'med',global:false,group:'obra',label:'Medição física'});
 });
 it('todos os destinos internos têm um grupo e identidade única',()=>{
  const items=workNavigationGroups(true).flatMap(group=>group.itens.map(([id])=>({id,group:group.id})));
  expect(new Set(items.map(item=>item.id)).size).toBe(items.length);
  for(const item of items)expect(workNavigationTarget(item.id,true)).toMatchObject({...item,global:false});
  expect(workNavigationTarget('tela-inexistente',true)).toBeNull();
 });
 it('mantém o portal restrito ao menu administrativo',()=>{
  expect(workNavigationTarget('portal')).toBeNull();
  expect(workNavigationTarget('portal',true)).toMatchObject({group:'recursos'});
 });
});
