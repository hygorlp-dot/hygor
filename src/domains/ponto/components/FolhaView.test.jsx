import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import Folha from './FolhaView';
import { archivedCltScenario } from '../../../fixtures/archived-clt.js';
import { rebuildArchivedLaborCosts } from '../../../../server/financial-archived-costs-source.js';

let root, container;
afterEach(() => { if(root) act(()=>root.unmount()); container?.remove(); vi.useRealTimers(); });

it('separa Obras de Administração Central e impede fechamento parcial da empresa',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,23,12));
  const employees=[{id:'p',name:'Pedreiro de campo',role:'Pedreiro',dailyRate:100,obra:'o',active:true},{id:'m',name:'Mestre da equipe',role:'Mestre de obras',dailyRate:200,obra:'o',active:true},{id:'a',name:'Assistente central',workArea:'administrativo',dailyRate:150,active:true}];
  const data={config:{},employees,obras:[{id:'o',name:'Obra'}],attendance:Object.fromEntries(employees.map(employee=>[employee.id,{'2026-10-21':{status:'P',obraId:employee.obra||''}}])),advances:[],changeLog:[]};
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<Folha data={data} currentUser={{id:'rh',role:'rh'}} showToast={()=>{}}/>));
  const button=name=>[...container.querySelectorAll('button')].find(item=>item.textContent.trim()===name);
  act(()=>button('Administração Central').click());
  expect(container.textContent).toContain('Mestre da equipe');expect(container.textContent).toContain('Assistente central');
  expect(container.textContent).not.toContain('Pedreiro de campo');expect(button('Fechar quinzena').disabled).toBe(true);
  act(()=>button('Obras').click());expect(container.textContent).toContain('Pedreiro de campo');expect(container.textContent).not.toContain('Mestre da equipe');
  data.titulosFolha=employees.map(employee=>({id:`t-${employee.id}`,employeeId:employee.id,periodKey:'2026-10-Q2',liquido:employee.dailyRate}));
  act(()=>root.render(<Folha data={data} currentUser={{id:'rh',role:'rh'}} showToast={()=>{}}/>));
  act(()=>button('Administração Central').click());
  expect(container.textContent).not.toContain('O ponto mudou depois do fechamento');
  expect(container.textContent).toContain('Fechamento da empresa (Consolidado)');
});

it('Folha mantém salário CLT de R$ 2.300 depois do arquivo sem voltar a pagar diária',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,6,18,12));
  const {data,archiveRows}=archivedCltScenario();
  const archived=rebuildArchivedLaborCosts({data,archiveRows}).data;
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<Folha data={archived} currentUser={{id:'rh',role:'rh'}} showToast={()=>{}}/>));
  expect(container.querySelector('.payroll-summary-strip__net strong').textContent).toMatch(/R\$\s*0,00/);
  const clt=[...container.querySelectorAll('button')].find(button=>button.textContent.trim()==='Holerites CLT');
  act(()=>clt.click());
  const select=[...container.querySelectorAll('select')].find(item=>[...item.options].some(option=>option.value==='clt-1'));
  act(()=>{select.value='clt-1';select.dispatchEvent(new Event('change',{bubbles:true}));});
  const salary=[...container.querySelectorAll('label')].find(label=>label.textContent==='Salário contratual mensal (R$)');
  expect(salary.parentElement.querySelector('input').value).toBe('2300');
  expect(container.querySelector('.clt-totals div:first-child strong').textContent).toMatch(/2\.300,00/);
});

// Feriado é pago pela obra do último dia trabalhado antes dele (decisão de
// 20/10/2026), não pela lotação: trabalhou na obra de trabalho na sexta
// 04/09 e em 14/09, então os feriados de 07/09 e 15/09 vão para ela - mesmo
// com ponto lançado nos próprios feriados.
it('feriados vão para a obra onde o funcionário trabalhou, não para a lotação', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026,8,18,12));
  const attendance = {};
  for(const day of [4,7,8,9,10,11,14,15,16,17,18]) attendance[`2026-09-${day.toString().padStart(2,'0')}`]={status:'P',obraId:'emprestimo'};
  const data={config:{},employees:[{id:'e',name:'Funcionário emprestado',active:true,obra:'lotacao',dailyRate:100}],
    obras:[{id:'lotacao',name:'Obra de lotação'},{id:'emprestimo',name:'Obra de trabalho'},{id:'vazia',name:'Sem movimento'}],
    attendance:{e:attendance},changeLog:[],advances:[]};
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<Folha data={data} showToast={()=>{}}/>));
  const total=()=>container.querySelector('.payroll-summary-strip__net strong').textContent;
  const select=[...container.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value===data.obras[0].id));
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
  const select=[...container.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value===data.obras[0].id));
  const filter=value=>act(()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(total()).toMatch(/1\.100,00/);
  filter('adm'); expect(total()).toMatch(/1\.100,00/);
  filter('fixa'); expect(total()).toMatch(/R\$\s*0,00/);
});

it('dia sem obra no ponto segue o histórico do cadastro (obraHistory), como a DRE', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026,8,18,12));
  const attendance = {};
  for(const day of [8,9,10,11,14,15,16,17,18]) attendance[`2026-09-${day.toString().padStart(2,'0')}`]={status:'P'};
  const data={config:{},employees:[{id:'e',name:'Transferido',active:true,obra:'nova',dailyRate:100,
      obraHistory:[{date:'2026-09-14',fromObraId:'antiga',toObraId:'nova'}]}],
    obras:[{id:'antiga',name:'Obra antiga'},{id:'nova',name:'Obra nova'}],
    attendance:{e:attendance},changeLog:[],advances:[]};
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<Folha data={data} showToast={()=>{}}/>));
  const total=()=>container.querySelector('.payroll-summary-strip__net strong').textContent;
  const select=[...container.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value===data.obras[0].id));
  const filter=value=>act(()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  // Antiga: 08-11/09 (antes da transferência de 14/09) + feriado de 07/09
  // (sem dia trabalhado antes: lotação histórica). Nova: 14, 16, 17, 18/09 +
  // feriado de 15/09 (dia anterior trabalhado já na nova).
  filter('antiga'); expect(total()).toMatch(/R\$\s*500,00/);
  filter('nova'); expect(total()).toMatch(/R\$\s*500,00/);
  filter('all'); expect(total()).toMatch(/1\.000,00/);
});
