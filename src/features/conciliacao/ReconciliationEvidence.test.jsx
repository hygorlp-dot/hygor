import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it} from 'vitest';
import ReconciliationEvidence from './ReconciliationEvidence.jsx';
let root,el;
afterEach(()=>{act(()=>root?.unmount());el?.remove();});
it('FITID não aparece como chave PIX nem como divergência e o movimento fica intacto',()=>{
 const transaction={chave:'fit:202611170772',valor:-100},before=JSON.stringify(transaction);
 el=document.createElement('div');document.body.append(el);root=createRoot(el);
 act(()=>root.render(<ReconciliationEvidence transaction={transaction} candidate={{titulo:'Nota',contraparte:'Fornecedor',saldoCentavos:10000}} identities={[{nome:'Fornecedor',aliases:[],documentos:[],pix:['12345678900']}]} data={{}} fmt={String}/>));
 const pix=[...el.querySelectorAll('[role=row]')].find(row=>row.textContent.startsWith('Chave PIX'));
 expect(pix.dataset.evidence).toBe('missing');expect(pix.textContent).toContain('Não informado');expect(pix.textContent).not.toContain('fit:');
 expect(el.textContent).toContain('identificador da linha evita duplicidades');expect(JSON.stringify(transaction)).toBe(before);
});

it.each([
 [' FORNECEDOR@EXAMPLE.TEST ', 'fornecedor@example.test', 'match'],
 ['fornecédor@example.test', 'fornecedor@example.test', 'different'],
])('a comparação visual da chave %s usa o mesmo critério de identidade', (bank,registered,state)=>{
 el=document.createElement('div');document.body.append(el);root=createRoot(el);
 act(()=>root.render(<ReconciliationEvidence transaction={{chavePix:bank,valor:-100}} candidate={{titulo:'Nota',contraparte:'Fornecedor',saldoCentavos:10000}} identities={[{nome:'Fornecedor',aliases:[],documentos:[],pix:[registered]}]} data={{}} fmt={String}/>));
 const pix=[...el.querySelectorAll('[role=row]')].find(row=>row.textContent.startsWith('Chave PIX'));
 expect(pix.dataset.evidence).toBe(state);
});
