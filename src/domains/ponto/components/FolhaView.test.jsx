import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import Folha from './FolhaView';

let root, container;
afterEach(() => { if(root) act(()=>root.unmount()); container?.remove(); vi.useRealTimers(); });

it('inclui feriados na obra histórica mesmo quando todo o ponto está em outra obra', () => {
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
  filter('lotacao'); expect(total()).toMatch(/200,00/);
  expect(container.querySelectorAll('article')).toHaveLength(1);
  filter('emprestimo'); expect(total()).toMatch(/800,00/);
  filter('vazia'); expect(total()).toMatch(/0,00/);
  expect(container.querySelectorAll('article')).toHaveLength(0);
  filter('all'); expect(total()).toMatch(/1\.000,00/);
});
