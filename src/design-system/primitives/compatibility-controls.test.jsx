import {act,createRef} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import {SelectControl} from './Select.jsx';
import {ChoiceControl} from './ChoiceControl.jsx';
import {RecordAction} from './RecordAction.jsx';
import {FilePicker} from '../patterns/FilePicker.jsx';

it('preserva rótulo, referência, valor e evento em seletores compostos',()=>{
 const el=document.createElement('div'),root=createRoot(el),ref=createRef();let selected='a';document.body.append(el);
 try{act(()=>root.render(<label>Conta<SelectControl ref={ref} value="a" onChange={e=>selected=e.target.value}><option value="a">Empresa</option><option value="b">Obra</option></SelectControl></label>));expect(ref.current.labels[0].textContent).toContain('Conta');act(()=>{ref.current.value='b';ref.current.dispatchEvent(new Event('change',{bubbles:true}));});expect(selected).toBe('b');}finally{act(()=>root.unmount());el.remove();}
});
it('seleção em label e abertura de registro não submetem o formulário',()=>{
 const el=document.createElement('div'),root=createRoot(el);let selected=false,opened=0,submitted=0;document.body.append(el);
 try{act(()=>root.render(<form onSubmit={e=>{e.preventDefault();submitted++;}}><label>Incluir vencidos<ChoiceControl checked={false} onChange={e=>selected=e.target.checked}/></label><RecordAction onClick={()=>opened++}>Abrir título</RecordAction></form>));act(()=>{el.querySelector('label').click();el.querySelector('button').click();});expect(selected).toBe(true);expect(opened).toBe(1);expect(submitted).toBe(0);}finally{act(()=>root.unmount());el.remove();}
});
it('seletor de arquivos mantém disabled, múltiplos e o evento original',()=>{
 const el=document.createElement('div'),root=createRoot(el);let files;document.body.append(el);
 try{const render=disabled=>act(()=>root.render(<FilePicker disabled={disabled} multiple accept=".pdf" onChange={e=>files=e.target.files} buttonLabel="Selecionar comprovantes"/>));render(true);expect(el.querySelector('button').disabled).toBe(true);expect(el.querySelector('input').disabled).toBe(true);render(false);const input=el.querySelector('input');expect(input.multiple).toBe(true);expect(input.accept).toBe('.pdf');const chosen=[new File(['teste'],'comprovante.pdf',{type:'application/pdf'})];Object.defineProperty(input,'files',{value:chosen});act(()=>input.dispatchEvent(new Event('change',{bubbles:true})));expect(files).toBe(chosen);}finally{act(()=>root.unmount());el.remove();}
});
