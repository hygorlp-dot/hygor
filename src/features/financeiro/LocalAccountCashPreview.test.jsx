import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import LocalAccountCashPreview from './LocalAccountCashPreview.jsx';
let root,el;
afterEach(()=>{if(root)act(()=>root.unmount());el?.remove();root=null;el=null;});
it('mantém os campos desconhecidos em branco e abre o memorial antes de simular saldo',()=>{
 const data={extratos:[{id:'s',banco:'Banco Intermedium S/A',conta:'000009896',arquivo:'extrato.ofx',status:'arquivado'}],transacoes:[{id:'t',extratoId:'s',data:'2026-07-01',valor:-10,status:'pendente'}]};
 const before=structuredClone(data),onOpen=vi.fn();el=document.createElement('div');document.body.append(el);root=createRoot(el);
 act(()=>root.render(<LocalAccountCashPreview data={data} ledger={{events:[]}} today="2026-10-31" obraId="all" onOpen={onOpen}/>));
 const fields=[...el.querySelectorAll('input')];expect(fields.filter(input=>input.readOnly&&input.value==='')).toHaveLength(6);
 expect([...el.querySelectorAll('.account-cash input')].every(input=>input.value==='')).toBe(true);
 expect(el.textContent).toContain('Posição ainda não calculada');expect(el.textContent).not.toContain('Valor do cadastro:');
 act(()=>[...el.querySelectorAll('button')].find(button=>button.textContent==='Pendentes na prévia: 1').click());
 expect(onOpen.mock.calls[0][0]).toMatchObject({items:[{amountCents:-1000,record:{id:'t',contaBancariaId:'local_account_preview_9896'}}]});
 expect(onOpen.mock.calls[0][0].context).toContain('não aplicada');expect(data).toEqual(before);
});
