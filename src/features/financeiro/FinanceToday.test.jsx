import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,afterEach,beforeEach,vi} from 'vitest';
import FinanceToday from './FinanceToday.jsx';
import {FinancialOverviewMetrics} from './FinancialOverviewMetrics.jsx';
let root,container;
beforeEach(()=>vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}))));
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();});
function render(element){container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(element));}
it('troca a fila e abre o memorial do título selecionado',()=>{
  const onOpen=vi.fn(),item={id:'n',description:'NF 123',obra:'Obra A',amountCents:7000,dueDate:'2026-01-20',direction:'A pagar'};
  render(<FinanceToday today="2026-01-20" work="Obra A" onOpen={onOpen} queues={[{id:'payToday',label:'Pagar hoje',items:[item],amountCents:7000},{id:'receiveToday',label:'Receber hoje',items:[],amountCents:0}]}/>);
  const buttons=[...container.querySelectorAll('button')];act(()=>buttons.find(b=>b.textContent==='NF 123').click());
  expect(onOpen).not.toHaveBeenCalled();
  act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Consultar detalhamento').click());
  act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Voltar à fila').click());
  expect(onOpen.mock.calls[0][0].items).toEqual([item]);
  choose('Movimentação','A receber');
  expect(container.textContent).toContain('Nenhum título em todos os prazos');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
});
it('cada valor principal abre a composição correta',()=>{
  const onSelect=vi.fn();render(<FinancialOverviewMetrics totals={{result:1,revenue:2,costs:1,cashIn:3,cashOut:4,receivable:5,payable:6}} margin={50} onSelect={onSelect}/>);
  const buttons=[...container.querySelectorAll('button')];expect(buttons).toHaveLength(7);
  act(()=>buttons.forEach(b=>b.click()));expect(onSelect.mock.calls.map(c=>c[0])).toEqual(['result','revenue','costs','cashIn','cashOut','receivable','payable']);
});
it('oferece vencidos sem trocar silenciosamente uma fila vazia',()=>{
 const item={id:'past',description:'NF vencida',obra:'Obra A',amountCents:100,dueDate:'2026-01-01'};
 render(<FinanceToday today="2026-01-20" work="Obra A" queues={[{id:'payToday',label:'Pagar hoje',items:[],amountCents:0},{id:'overdue',label:'Vencidos',items:[item],amountCents:100}]} onOpen={()=>{}}/>);
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent.startsWith('Hoje ·')).click());
 expect(container.textContent).toContain('Nenhum título em hoje');
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Conferir vencidos').click());
 expect(container.textContent).toContain('NF vencida');expect(container.textContent).not.toContain('Nenhum título em hoje');
});
it('abre a revisão contextual sem substituir a consulta do memorial',()=>{
 const item={id:'n',description:'NF parcial',obra:'Obra A',amountCents:7000},onAction=vi.fn(),onOpen=vi.fn();
 render(<FinanceToday today="2026-10-31" work="Obra A" queues={[{id:'payToday',label:'Pagar hoje',items:[item],amountCents:7000}]} onOpen={onOpen} onAction={onAction} resolveAction={()=>({label:'Conferir documento',reason:'Confira a origem antes de prosseguir.'})}/>);
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Conferir documento').click());
 expect(onAction).toHaveBeenCalledWith(item);expect(onOpen).not.toHaveBeenCalled();
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='NF parcial').click());
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Consultar detalhamento').click());
 expect(onOpen.mock.calls[0][0].items).toEqual([item]);
});

function choose(label,value){const control=[...container.querySelectorAll('select')].find(el=>el.labels[0]?.textContent.includes(label));act(()=>{control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));});}
it('mantém direção, prazo e IDs entre tabela e quadro sem executar operações',()=>{
 const pay={id:'pay',description:'Pagamento parcial',amountCents:7000,direction:'A pagar',dueDate:'2026-01-20',obra:'Obra A'},receive={...pay,id:'receive',direction:'A receber'},later={...pay,id:'later',dueDate:'2026-02-20'},undated={...pay,id:'undated',dueDate:''},onOpen=vi.fn(),onAction=vi.fn();
 render(<FinanceToday today="2026-01-20" work="Obra A" queues={[{id:'payToday',label:'Pagar hoje',items:[pay],amountCents:7000},{id:'receiveToday',label:'Receber hoje',items:[receive],amountCents:7000},{id:'later',label:'Depois',items:[later],amountCents:7000},{id:'undated',label:'Sem vencimento',items:[undated],amountCents:7000}]} onOpen={onOpen} onAction={onAction}/>);
 const tableIds=()=>[...container.querySelectorAll('tbody tr')].map(el=>el.dataset.record).sort(),boardIds=()=>[...container.querySelectorAll('.mrc-work-board li')].map(el=>el.dataset.record).sort();
 expect(tableIds()).toEqual(['later','pay','undated']);choose('Visualização','kanban');expect(boardIds()).toEqual(['later','pay','undated']);expect(container.querySelector('[draggable=true]')).toBeNull();
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent.startsWith('Hoje ·')).click());expect(boardIds()).toEqual(['pay']);choose('Movimentação','A receber');expect(boardIds()).toEqual(['receive']);choose('Visualização','table');expect(tableIds()).toEqual(['receive']);expect(onOpen).not.toHaveBeenCalled();expect(onAction).not.toHaveBeenCalled();
});

it('revalida a ficha na fila atual e não oferece ação para registro removido',()=>{
 const item={id:'gone',description:'NF removida',amountCents:100,obra:'Obra A'},onAction=vi.fn();
 const view=items=><FinanceToday today="2026-11-01" work="Obra A" queues={[{id:'payToday',label:'Hoje',items,amountCents:100}]} onAction={onAction} resolveAction={()=>null}/>;
 render(view([item]));act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='NF removida').click());expect(container.textContent).toContain('Não há ação operacional disponível');
 act(()=>root.render(view([])));expect(container.textContent).toContain('O título saiu deste recorte');expect(container.querySelector('.mrc-record-panel__actions')).toBeNull();expect(onAction).not.toHaveBeenCalled();
});
