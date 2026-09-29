import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import BoxMemoryPanel from './BoxMemoryPanel';
import { removeBoxElement, saveBoxElement } from '../box-memory';
import { syncItemMemories } from '../item-memory';

let root, container;
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); });
const enter = async (input, value) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', {bubbles:true})); });
const field = text => [...container.querySelectorAll('label')].find(l => l.textContent.startsWith(text)).querySelector('input,select');
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.startsWith(text));
const click = async text => act(async () => button(text).click());
const fillBox = async () => {
  for (const [text, value] of [['Comprimento interno','2'],['Largura interna','1,5'],['Altura das paredes','1,2'],['Espessura da parede','14']]) await enter(field(text), value);
};

const initial = {
  id:'b', bdi:25, etapas:[{id:'s0',nome:'FUNDAÇÃO'},{id:'res',nome:'RESERVATÓRIO'}],
  itens:[
    {id:'f',etapaId:'s0',descricao:'ESCAVAÇÃO MANUAL',unidade:'M3',quantidade:3},
    {id:'r',etapaId:'res',fonte:'SINAPI',codigo:'97101',descricao:'EXECUÇÃO DE RADIER, ESPESSURA DE 10 CM',unidade:'M2',quantidade:10,precoUnit:100},
    {id:'a',etapaId:'res',fonte:'SINAPI',codigo:'89455',descricao:'ALVENARIA DE BLOCOS DE CONCRETO ESTRUTURAL 14X19X39 CM',unidade:'M2',quantidade:0},
    {id:'t',etapaId:'res',fonte:'SINAPI',codigo:'97090',descricao:'ARMAÇÃO PARA EXECUÇÃO DE RADIER COM USO DE TELA Q-138',unidade:'KG',quantidade:0},
    {id:'b1',etapaId:'res',fonte:'SINAPI',codigo:'94796',descricao:'TORNEIRA DE BOIA PARA CAIXA DAGUA',unidade:'UN',quantidade:0},
    {id:'m',etapaId:'res',fonte:'SINAPI',codigo:'87879',descricao:'CHAPISCO APLICADO EM ALVENARIAS',unidade:'M2',quantidade:7,memorialMedicao:{model:'surface',active:true,rows:[]}},
  ],
};

it('mede uma vez, mostra a conta e a prévia antes → depois, e só grava ao confirmar',async()=>{
  let latest = initial;
  function App(){
    const [budget,setBudget]=useState(initial);
    const commit=next=>{latest=syncItemMemories(next).budget;setBudget(latest);return {ok:true};};
    return <BoxMemoryPanel budget={budget} onSave={async(el,links)=>commit(saveBoxElement(budget,el,links))} onRemove={async id=>commit(removeBoxElement(budget,id))}/>;
  }
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<App/>));
  await click('Medir um reservatório');

  expect(field('Etapa do orçamento').value).toBe('res');
  expect(container.querySelectorAll('.box-item')).toHaveLength(5);
  expect(container.textContent).not.toContain('ESCAVAÇÃO');
  // Item já medido no memorial item a item: avisado e fora da seleção.
  const chapisco=[...container.querySelectorAll('.box-item')].find(r=>r.textContent.includes('CHAPISCO'));
  expect(chapisco.querySelector('input[type="checkbox"]').checked).toBe(false);
  expect(chapisco.textContent).toContain('Marcar substitui essa medição');

  expect(button('Revisar e aplicar').disabled).toBe(true);
  expect(container.textContent).toContain('Preencha as medidas da caixa para calcular os 4 serviços marcados');
  await fillBox();
  expect(container.textContent).toContain('(2,00 + 2×0,14) × (1,50 + 2×0,14) = 2,28 × 1,78 = 4,06 m²');
  expect(container.textContent).toContain('8,93 kg');

  // Enter num campo não grava nada.
  await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(latest).toBe(initial);

  await click('Revisar e aplicar');
  const review=container.querySelector('.box-review');
  expect(review.textContent).toContain('Confira antes de gravar');
  expect(review.textContent).toMatch(/R\$\s?1\.250,00/); // radier hoje: 10 × 100 + 25% BDI
  expect(review.textContent).toMatch(/R\$\s?507,50/);   // novo: 4,06 × 100 + 25% BDI
  expect(latest).toBe(initial);

  await click('Confirmar e aplicar');
  expect(Object.fromEntries(latest.itens.map(i=>[i.id,i.quantidade]))).toEqual({f:3,r:4.06,a:9.07,t:8.93,b1:1,m:7});
  expect(latest.itens.find(i=>i.id==='m').memorialMedicao.model).toBe('surface');
  expect(container.querySelector('[role="status"]').textContent).toContain('Aplicado em 4 serviços');

  await enter(field('Reservatórios iguais'),'2');
  await click('Revisar e aplicar');
  await click('Confirmar e aplicar');
  expect(latest.itens.find(i=>i.id==='b1').quantidade).toBe(2);

  await click('Excluir reservatório');
  expect(latest.elementosMemoria).toHaveLength(1);
  await act(async()=>[...container.querySelectorAll('.box-confirm button')].find(b=>b.textContent==='Excluir').click());
  expect(latest.elementosMemoria).toEqual([]);
  expect(latest.itens.find(i=>i.id==='b1')).toMatchObject({quantidade:2});
  expect(container.textContent).toContain('Nenhum reservatório medido');
});

it('preserva o rascunho ao trocar de aba e mostra a falha real do servidor sem perder as medidas',async()=>{
  const withBox={...initial,elementosMemoria:[{id:'x',nome:'Superior',etapaId:'res',comprimento:'1',largura:'1',altura:'1',espessuraCm:'14',quantidade:'1'}]};
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<BoxMemoryPanel budget={withBox} onSave={async()=>({ok:false,reason:'Sem conexão'})} onRemove={async()=>({ok:true})}/>));
  await click('Novo reservatório');
  await fillBox();
  await act(async()=>container.querySelector('.box-memory__tabs button').click());
  expect(field('Comprimento interno').value).toBe('1');
  await act(async()=>[...container.querySelectorAll('.box-memory__tabs button')].find(b=>b.textContent.includes('não salvo')).click());
  expect(field('Comprimento interno').value).toBe('2');
  await click('Revisar e aplicar');
  await click('Confirmar e aplicar');
  expect(container.querySelector('[role="alert"]').textContent).toBe('Sem conexão');
  expect(field('Largura interna').value).toBe('1,5');
});
