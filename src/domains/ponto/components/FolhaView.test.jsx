import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import Folha from './FolhaView';

let root, container;
afterEach(() => { if(root) act(()=>root.unmount()); container?.remove(); vi.useRealTimers(); });

// Feriado é pago pela obra do último dia trabalhado antes dele (decisão de
// 20/10/2026), não pela lotação: todo o ponto na obra de trabalho leva também
// os feriados de 07/09 e 15/09 para ela.
it('feriados vão para a obra onde o funcionário trabalhou, não para a lotação', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026,8,18,12));
  const attendance = {};
  for(const day of [7,8,9,10,11,14,15,16,17,18]) attendance[`2026-09-${day.toString().padStart(2,'0')}`]={status:'P',obraId:'emprestimo'};
  const data={config:{},employees:[{id:'e',name:'Funcionário emprestado',active:true,obra:'lotacao',dailyRate:100}],
    obras:[{id:'lotacao',name:'Obra de lotação'},{id:'emprestimo',name:'Obra de trabalho'},{id:'vazia',name:'Sem movimento'}],
    attendance:{e:attendance},changeLog:[],advances:[]};
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<Folha data={data} showToast={()=>{}}/>));
  const total=()=>container.querySelector('.payroll-summary-strip__net strong').textContent;
  const select=[...container.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='all'));
  const filter=value=>act(()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(total()).toMatch(/1\.000,00/);
  filter('lotacao'); expect(total()).toMatch(/R\$\s*0,00/);
  expect(container.querySelectorAll('article')).toHaveLength(0);
  filter('emprestimo'); expect(total()).toMatch(/1\.000,00/);
  expect(container.querySelectorAll('article')).toHaveLength(1);
  filter('vazia'); expect(total()).toMatch(/0,00/);
  expect(container.querySelectorAll('article')).toHaveLength(0);
  filter('all'); expect(total()).toMatch(/1\.000,00/);
});

it('feriado sem ponto vai para a obra do último dia trabalhado (12/10 na obra por administração)', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026,9,20,12));
  const attendance = {};
  for(const day of [6,7,8,9,13,14,15,16,19,20]) attendance[`2026-10-${day.toString().padStart(2,'0')}`]={status:'P',obraId:'adm'};
  const data={config:{},employees:[{id:'e',name:'Funcionário global',active:true,obra:'fixa',dailyRate:100}],
    obras:[{id:'fixa',name:'Obra de lotação',contractType:'fixed_labor'},{id:'adm',name:'Obra por administração',contractType:'admin_only',adminPercentage:15}],
    attendance:{e:attendance},changeLog:[],advances:[]};
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<Folha data={data} showToast={()=>{}}/>));
  const total=()=>container.querySelector('.payroll-summary-strip__net strong').textContent;
  const select=[...container.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='all'));
  const filter=value=>act(()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(total()).toMatch(/1\.100,00/);
  filter('adm'); expect(total()).toMatch(/1\.100,00/);
  filter('fixa'); expect(total()).toMatch(/R\$\s*0,00/);
});
