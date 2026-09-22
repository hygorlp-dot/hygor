import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import ItemMemoryPanel from './ItemMemoryPanel';
import { saveItemMemory } from '../item-memory';
let root,container;
afterEach(()=>{act(()=>root?.unmount());container?.remove();vi.restoreAllMocks();});
const initial={id:'b',etapas:[{id:'s',nome:'Alvenaria térreo'}],itens:[{id:'i',etapaId:'s',descricao:'Alvenaria de vedação',unidade:'M2',quantidade:40,precoUnit:30},{id:'other',etapaId:'s',descricao:'Pintura de paredes',unidade:'M2',quantidade:0}]};
const enter=async(input,value)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
const click=async text=>act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent===text).click());

it('guia o preenchimento, retém rascunho ao trocar item e salva quantidade sem alterar preço',async()=>{
  let latest=initial;
  function App(){const [budget,setBudget]=useState(initial);return <ItemMemoryPanel budget={budget} budgets={[budget]} onNavigate={()=>{}} onOpenOwner={()=>{}} onSave={async(id,record,options)=>{latest=saveItemMemory(budget,id,record,options);setBudget(latest);return {ok:true};}} onSaveModel={async model=>{latest={...budget,modelosMemorial:[model]};setBudget(latest);return {ok:true};}}/>;}
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<App/>));
  const form=()=>container.querySelector('form');
  expect(form().textContent).toContain('Destino fixo: item 1.1');
  await enter(form().querySelector('input[placeholder^="Ex.: térreo"]'),'Sala');
  await enter(form().querySelector('[aria-label="Comprimento da medição 1"]'),'4');
  await enter(form().querySelector('[aria-label="Altura da medição 1"]'),'2,80');
  await act(async()=>container.querySelectorAll('nav button')[1].click());
  await act(async()=>container.querySelectorAll('nav button')[0].click());
  expect(form().querySelector('[aria-label="Altura da medição 1"]').value).toBe('2,80');
  await click('− Adicionar desconto / vão');
  await enter(form().querySelectorAll('input[placeholder^="Ex.: térreo"]')[1],'Porta');
  await enter(form().querySelector('[aria-label="Comprimento da medição 2"]'),'0,80');
  await enter(form().querySelector('[aria-label="Altura da medição 2"]'),'2,10');
  expect(form().textContent).toContain('9,52 M2');
  await act(async()=>form().dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(latest.itens[0]).toMatchObject({quantidade:9.52,precoUnit:30,memorialMedicao:{active:true}});
  expect(container.textContent).toContain('Memorial salvo e quantidade');
  await enter(form().querySelector('input[placeholder^="Ex.: alvenaria"]'),'Parede padrão');
  await click('Salvar modelo');
  expect(latest.modelosMemorial[0].name).toBe('Parede padrão');
  expect(latest.modelosMemorial[0]).not.toHaveProperty('rows');
});

it('mostra falha real de persistência e mantém as medidas digitadas',async()=>{
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<ItemMemoryPanel budget={initial} onSave={async()=>({ok:false,reason:'Sem conexão'})} onNavigate={()=>{}}/>));
  await enter(container.querySelector('input[placeholder^="Ex.: térreo"]'),'Sala');
  await click('Salvar rascunho');
  expect(container.querySelector('[role="alert"]').textContent).toBe('Sem conexão');
  expect(container.querySelector('input[placeholder^="Ex.: térreo"]').value).toBe('Sala');
});
