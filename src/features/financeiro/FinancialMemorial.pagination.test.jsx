import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import FinancialMemorial from './FinancialMemorial.jsx';
HTMLDialogElement.prototype.showModal=function(){this.open=true;};
HTMLDialogElement.prototype.close=function(){this.open=false;};
let root,el;
afterEach(()=>{if(root)act(()=>root.unmount());el?.remove();root=null;el=null;});
const items=Array.from({length:105},(_,i)=>({id:`i${i}`,description:`${i<61?'Grupo':'Outro'} ${i}`,amountCents:100,date:'2026-07-01',record:{id:`r${i}`,descricao:'Detalhe completo'}}));
function render(detail={title:'Memorial QA',items},extra={}){el=document.createElement('div');document.body.append(el);root=createRoot(el);act(()=>root.render(<FinancialMemorial detail={detail} onClose={()=>{}} {...extra}/>));}
const button=label=>[...el.querySelectorAll('button')].find(b=>b.textContent===label);
it('pagina sem montar detalhes recolhidos e pesquisa no conjunto inteiro com subtotal',()=>{
 render();expect(el.querySelectorAll('.dre-memorial__entry')).toHaveLength(50);expect(el.querySelectorAll('.dre-memorial__body')).toHaveLength(0);
 act(()=>button('Próxima página').click());expect(el.textContent).toContain('Página 2 de 3');
 const input=el.querySelector('input');act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Grupo');input.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(el.textContent).toContain('61 encontrado(s)');expect(el.textContent).toMatch(/Subtotal da busca: R\$\s61,00/);expect(el.textContent).toMatch(/Total do conjunto: R\$\s105,00/);expect(el.textContent).toContain('Página 1 de 2');
 act(()=>button('Próxima página').click());expect(el.querySelectorAll('.dre-memorial__entry')).toHaveLength(11);expect(el.textContent).toMatch(/Subtotal da busca: R\$\s61,00/);
});
it('mantém página e identificadores de expansão no retorno dos documentos',()=>{
 const onDocuments=vi.fn();render({title:'Memorial QA',items,page:2},{onDocuments,canOpenDocuments:()=>true});
 const first=el.querySelector('.dre-memorial__entry');act(()=>{first.open=true;first.dispatchEvent(new Event('toggle'));});expect(el.querySelectorAll('.dre-memorial__body')).toHaveLength(1);
 el.querySelector('dialog').scrollTop=42;
 act(()=>button('Consultar na central de documentos').click());const detail=onDocuments.mock.calls[0][1];expect(detail.page).toBe(2);expect(detail.expandedIds).toContain('i100:100');expect(detail.scrollTop).toBe(42);
 act(()=>root.unmount());root=null;el.remove();el=null;render(detail,{onDocuments,canOpenDocuments:()=>true});
 expect(el.textContent).toContain('Página 3 de 3');expect(el.querySelectorAll('.dre-memorial__entry')).toHaveLength(5);expect(el.querySelectorAll('.dre-memorial__body')).toHaveLength(1);expect(el.querySelector('dialog').scrollTop).toBe(42);
});
