import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import ClosingPending from './ClosingPending.jsx';
it('expõe bloqueios e origens documentais sem acionar fechamento',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el),open=vi.fn(),documents=vi.fn();
 const data={notasFiscais:[{id:'n',numero:'123',status:'recebida',emissao:'2026-10-01',valorBruto:100}],transacoes:[{id:'t',data:'2026-10-10',status:'parcial',descricao:'PIX parcial',valor:-30}]};
 act(()=>root.render(<ClosingPending data={data} competence="2026-10" conference={{errors:[{message:'Saldo inconsistente'}]}} onOpen={open} onDocuments={documents}/>));
 expect(el.querySelector('[role=alert]').textContent).toBe('Saldo inconsistente');expect(el.textContent).toContain('Movimentos bancários a revisar · 1');
 act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Consultar origem da pendência').click());expect(open.mock.calls[0][0].items[0].record.id).toBe('n');
 act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Abrir central deste mês').click());expect(documents).toHaveBeenCalledOnce();
 act(()=>root.unmount());el.remove();
});
