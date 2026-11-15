import { act,useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import Orcamento from './OrcamentoView';
let root,container;
afterEach(()=>{act(()=>root?.unmount());container?.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('mantém o sexto nível após falha e repete a gravação sem duplicar a etapa',async()=>{
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  vi.stubGlobal('IntersectionObserver',class {observe(){} disconnect(){} unobserve(){}});
  window.scrollTo=vi.fn();Element.prototype.scrollIntoView=vi.fn();
  const initial={obras:[{id:'o',name:'Obra'}],employees:[],attendance:{},config:{},orcamentos:[{id:'b',obraId:'o',etapas:Array.from({length:5},(_,i)=>({id:'s'+i,nome:'Etapa '+i,parentId:i?'s'+(i-1):''})),itens:[]}],budgetBaselines:[{obraId:'o',tipo:'controle',budgetId:'b'}]};
  let fail=true,latest=initial;
  function App(){const [data,setData]=useState(initial);return <Orcamento data={data} obraIdFixo="o" currentUser={{role:'admin'}} showToast={()=>{}} update={async next=>{if(fail){fail=false;return {ok:false,reason:'Falha de teste'};}latest=next;setData(next);return {ok:true};}}/>;}
  container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<App/>));
  await act(async()=>container.querySelector('[aria-label="Mais ações da etapa 1.1.1.1.1"]').click());
  await act(async()=>[...container.querySelectorAll('[role=menuitem]')].find(b=>b.textContent==='Criar subnível').click());
  const input=document.body.querySelector('[role=dialog] input');
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Acabamento');input.dispatchEvent(new Event('input',{bubbles:true}));});
  const save=()=>[...document.body.querySelectorAll('[role=dialog] button')].find(b=>b.textContent==='Salvar');
  await act(async()=>save().click());expect(input.value).toBe('Acabamento');expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
  await act(async()=>save().click());expect(latest.orcamentos[0].etapas).toHaveLength(6);expect(document.body.querySelector('[role=dialog]')).toBeNull();
});
it('abre a planilha real, reordena uma etapa e desfaz pelo controle geral',async()=>{
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  vi.stubGlobal('IntersectionObserver',class {observe(){} disconnect(){} unobserve(){}});
  window.scrollTo=vi.fn();Element.prototype.scrollIntoView=vi.fn();
  const initial={obras:[{id:'o',name:'Obra'}],employees:[],attendance:{},config:{},orcamentos:[{id:'b',obraId:'o',nome:'Teste',bdi:0,memoriaCalculo:{terreo:{pilar:{concretoM3:1}},vinculosEstruturais:{'terreo-pilares.concreto':'missing'}},etapas:[{id:'s1',nome:'Térreo'},{id:'s2',nome:'Cobertura'}],itens:[{id:'i',etapaId:'s1',descricao:'Pintura',unidade:'M2',quantidade:1,precoUnit:10}]}],budgetBaselines:[{obraId:'o',tipo:'controle',budgetId:'b'}]};
  let latest=initial;
  function App(){const [data,setData]=useState(initial);return <Orcamento data={data} obraIdFixo="o" currentUser={{role:'admin'}} showToast={()=>{}} update={async next=>{latest=next;setData(next);return {ok:true};}}/>;}
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<App/>));
  expect(container.textContent).toContain('Conferência do orçamento inteiro');
  const handles=container.querySelectorAll('[aria-label^="Arrastar etapa"]');
  expect(handles).toHaveLength(2);
  const transfer={effectAllowed:'',setData:vi.fn()};
  await act(async()=>{const e=new Event('dragstart',{bubbles:true});Object.defineProperty(e,'dataTransfer',{value:transfer});handles[1].dispatchEvent(e);});
  await act(async()=>{const e=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:transfer});handles[0].parentElement.dispatchEvent(e);});
  expect(latest.orcamentos[0].etapas.map(s=>s.id)).toEqual(['s2','s1']);
  const undo=[...container.querySelectorAll('button')].find(b=>b.textContent==='Desfazer última alteração');
  await act(async()=>undo.click());
  expect(latest.orcamentos[0].etapas.map(s=>s.id)).toEqual(['s1','s2']);
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Gerenciar pavimentos').click());
  const form=document.body.querySelector('form.floor-create-form');
  const inputs=form.querySelectorAll('input');
  const enter=async(input,value)=>act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await enter(inputs[0],'Acesso');await enter(inputs[1],'-1,20');
  const select=form.querySelectorAll('select')[1];
  await act(async()=>{select.value='s1';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(latest.orcamentos[0].etapas[0]).toMatchObject({nome:'Acesso',nivelM:-1.2,pavimentoId:'terreo'});
  expect(latest.orcamentos[0].memoriaCalculo.cadastroPavimentos.terreo.nome).toBe('Acesso');
  const warning=[...container.querySelectorAll('.memory-audit-link')].find(b=>b.textContent.includes('Destino removido'));
  await act(async()=>{warning.click();await new Promise(resolve=>setTimeout(resolve,40));});
  expect(document.getElementById('terreo-pilares')).not.toBeNull();
  expect(document.getElementById('terreo-pilares').textContent).toContain('Concreto');
});
