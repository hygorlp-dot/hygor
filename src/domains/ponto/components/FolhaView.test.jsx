import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import Folha from './FolhaView';
import {applyAdvanceCommand,ADVANCE_COMMAND} from '../../rh/advance-commands.js';
import {registrarPagamentoEConciliar} from '../../conciliacao/mutations.js';

let root, container;
afterEach(() => { if(root) act(()=>root.unmount()); container?.remove(); vi.useRealTimers(); });

function octoberData(employee={}){
  const attendance=Object.fromEntries([6,7,8,9,13,14,15,16,19,20].map(day=>[`2026-10-${String(day).padStart(2,'0')}`,{status:'P',obraId:'A'}]));
  return {config:{},employees:[{id:'e',name:'Siclano QA',active:true,obra:'A',dailyRate:100,...employee}],
    obras:[{id:'A',name:'Obra A'}],attendance:{e:attendance},changeLog:[],advances:[],titulosFolha:[]};
}
it('CLT por diária usa Holerites CLT e não recebe líquido final automático no relatório de diária comum',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,20,12));
  const data=octoberData({employmentRelationship:'clt',remunerationMode:'daily'});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<Folha data={data} showToast={()=>{}}/>));
  expect(container.querySelector('.payroll-summary-strip__net strong').textContent).toMatch(/^R\$\s*0,00$/);
  expect(container.querySelectorAll('article')).toHaveLength(0);
  expect(container.textContent).toContain('Holerites CLT');
});
it('pagamento de adiantamento atualiza imediatamente a prévia sem alterar ponto ou cadastro',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,20,12));
  const created=applyAdvanceCommand(octoberData(),{type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED,actorId:'rh',
    payload:{advance:{id:'advance-view',empId:'e',amount:200,date:'2026-10-14',firstDueDate:'2026-10-20'}}}).data;
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  const render=data=>act(()=>root.render(<Folha data={data} showToast={()=>{}}/>));
  const total=()=>container.querySelector('.payroll-summary-strip__net strong').textContent;
  render(created);expect(total()).toMatch(/1\.100,00/);
  const paid=registrarPagamentoEConciliar({...created,transacoes:[{id:'bank',data:'2026-10-14',valor:-80,status:'pendente'}]},
    {transacaoId:'bank',tipo:'tituloFolha',entidadeId:created.advances[0].paymentTitleId,operador:{id:'financeiro'}});
  expect(paid.resumo.ok).toBe(true);expect(paid.data.attendance).toBe(created.attendance);
  render(paid.data);expect(total()).toMatch(/1\.020,00/);
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
  const select=[...container.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='all'));
  const filter=value=>act(()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  // Antiga: 08-11/09 (antes da transferência de 14/09) + feriado de 07/09
  // (sem dia trabalhado antes: lotação histórica). Nova: 14, 16, 17, 18/09 +
  // feriado de 15/09 (dia anterior trabalhado já na nova).
  filter('antiga'); expect(total()).toMatch(/R\$\s*500,00/);
  filter('nova'); expect(total()).toMatch(/R\$\s*500,00/);
  filter('all'); expect(total()).toMatch(/1\.000,00/);
});
