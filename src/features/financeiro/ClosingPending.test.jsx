import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import ClosingPending from './ClosingPending.jsx';
it('expõe bloqueios e origens documentais sem acionar fechamento',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el),open=vi.fn(),documents=vi.fn();
 const data={notasFiscais:[{id:'n',numero:'123',status:'recebida',emissao:'2026-10-01',valorBruto:100}],transacoes:[{id:'t',data:'2026-10-10',status:'parcial',descricao:'PIX parcial',valor:-30}]};
 act(()=>root.render(<ClosingPending data={data} competence="2026-10" conference={{errors:[{message:'Saldo inconsistente'}]}} onOpen={open} onDocuments={documents}/>));
 expect(el.querySelector('[role=alert]').textContent).toContain('Conferência financeira necessária');expect(el.querySelector('details').textContent).toContain('Saldo inconsistente');expect(el.textContent).toContain('Movimentos bancários a revisar · 1');
 act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Consultar origem da pendência').click());expect(open.mock.calls[0][0].items[0].record.id).toBe('n');
 act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Abrir central deste mês').click());expect(documents).toHaveBeenCalledOnce();
 act(()=>root.unmount());el.remove();
});
it('consulta o documento exato sem corrigir, pagar ou fechar e mantém o diagnóstico recolhido',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el),open=vi.fn(),correct=vi.fn(),documents=vi.fn();
 const data={obras:[{id:'a',name:'Obra Alameda'}],medicoes:[{id:'m',obraId:'a',numero:'MED-123',valorPrevisto:100,competencia:'2026-09'}]};
 const before=structuredClone(data);
 try{
  act(()=>root.render(<ClosingPending data={data} competence="2026-10" conference={{errors:[{code:'RECEIVABLE_OVERPAID',sourceType:'medicao',sourceId:'m',obraId:'a',differenceCents:3000},{code:'RECEIVABLE_NON_NEGATIVE',differenceCents:3000}]}} onOpen={open} onCorrect={correct} onDocuments={documents}/>));
  expect(el.textContent).toContain('não some os valores');
  expect(el.textContent).toContain('Medição · MED-123 · Obra Alameda');
  expect(el.querySelector('[role=alert] details').open).toBe(false);
  expect([...el.querySelectorAll('button')].filter(b=>b.textContent==='Consultar origem do bloqueio')).toHaveLength(1);
  act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Consultar origem do bloqueio').click());
  expect(open.mock.calls[0][0].items[0].record.id).toBe('m');
  expect(open.mock.calls[0][0].items[0].amountCents).toBe(10000);
  expect(correct).not.toHaveBeenCalled();expect(documents).not.toHaveBeenCalled();expect(data).toEqual(before);
 }finally{act(()=>root.unmount());el.remove();}
});
