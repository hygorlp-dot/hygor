import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,afterEach,vi} from 'vitest';
import FinanceToday from './FinanceToday.jsx';
import {FinancialOverviewMetrics} from './FinancialOverviewMetrics.jsx';
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();});
function render(element){container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(element));}
it('troca a fila e abre o memorial do título selecionado',()=>{
  const onOpen=vi.fn(),item={id:'n',description:'NF 123',obra:'Obra A',amountCents:7000,dueDate:'2026-01-20',direction:'A pagar'};
  render(<FinanceToday today="2026-01-20" work="Obra A" onOpen={onOpen} queues={[{id:'payToday',label:'Pagar hoje',items:[item],amountCents:7000},{id:'receiveToday',label:'Receber hoje',items:[],amountCents:0}]}/>);
  const buttons=[...container.querySelectorAll('button')];act(()=>buttons.find(b=>b.textContent==='Ver memorial').click());
  expect(onOpen.mock.calls[0][0].items).toEqual([item]);
  act(()=>buttons.find(b=>b.textContent.startsWith('Receber hoje')).click());
  expect(container.textContent).toContain('Nenhum título em receber hoje');
  expect(container.querySelector('[aria-pressed=true]').textContent).toContain('Receber hoje');
});
it('cada valor principal abre a composição correta',()=>{
  const onSelect=vi.fn();render(<FinancialOverviewMetrics totals={{result:1,revenue:2,costs:1,cashIn:3,cashOut:4,receivable:5,payable:6}} margin={50} onSelect={onSelect}/>);
  const buttons=[...container.querySelectorAll('button')];expect(buttons).toHaveLength(7);
  act(()=>buttons.forEach(b=>b.click()));expect(onSelect.mock.calls.map(c=>c[0])).toEqual(['result','revenue','costs','cashIn','cashOut','receivable','payable']);
});
it('oferece vencidos sem trocar silenciosamente uma fila vazia',()=>{
 const item={id:'past',description:'NF vencida',obra:'Obra A',amountCents:100,dueDate:'2026-01-01'};
 render(<FinanceToday today="2026-01-20" work="Obra A" queues={[{id:'payToday',label:'Pagar hoje',items:[],amountCents:0},{id:'overdue',label:'Vencidos',items:[item],amountCents:100}]} onOpen={()=>{}}/>);
 expect(container.textContent).toContain('Nenhum título em pagar hoje');
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Conferir vencidos').click());
 expect(container.textContent).toContain('NF vencida');expect(container.textContent).not.toContain('Nenhum título em pagar hoje');
});
