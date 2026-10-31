import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useUnsavedChanges} from './useUnsavedChanges.js';
function Harness({id='a',busy=false,onClose}){const [draft,setDraft]=useState({id,value:'Original'});const guard=useUnsavedChanges(draft,onClose,{identity:id,busy});return <><input aria-label="Valor" value={draft.value} onChange={e=>setDraft({...draft,value:e.target.value})}/><button onClick={guard.requestClose}>Fechar</button>{guard.asked&&<><p>Confirmar saída</p><button onClick={guard.continueEditing}>Continuar</button><button onClick={guard.discard}>Descartar</button></>}</>;}
it('protege interrupção, conserva o texto ao continuar e descarta somente por escolha explícita',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el),close=vi.fn(),storage=vi.spyOn(Storage.prototype,'setItem');
 const render=busy=>act(()=>root.render(<Harness onClose={close} busy={busy}/>)),click=text=>act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent===text).click());
 try{render(false);const input=el.querySelector('input');act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Preenchimento local');input.dispatchEvent(new Event('input',{bubbles:true}));});click('Fechar');expect(close).not.toHaveBeenCalled();click('Continuar');expect(input.value).toBe('Preenchimento local');const exit=new Event('beforeunload',{cancelable:true});window.dispatchEvent(exit);expect(exit.defaultPrevented).toBe(true);render(true);click('Fechar');expect(el.textContent).not.toContain('Confirmar saída');render(false);click('Fechar');click('Descartar');expect(close).toHaveBeenCalledTimes(1);expect(storage).not.toHaveBeenCalled();}finally{act(()=>root.unmount());el.remove();storage.mockRestore();}
});
it('fecha sem confirmação quando não houve alteração e remove proteção ao desmontar',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el),close=vi.fn();act(()=>root.render(<Harness onClose={close}/>));act(()=>el.querySelector('button').click());expect(close).toHaveBeenCalledTimes(1);act(()=>root.unmount());const exit=new Event('beforeunload',{cancelable:true});window.dispatchEvent(exit);expect(exit.defaultPrevented).toBe(false);el.remove();
});
it('protege recarga enquanto a confirmação está em andamento, mesmo sem editar os valores',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el),close=vi.fn();act(()=>root.render(<Harness onClose={close} busy/>));const exit=new Event('beforeunload',{cancelable:true});window.dispatchEvent(exit);expect(exit.defaultPrevented).toBe(true);act(()=>el.querySelector('button').click());expect(close).not.toHaveBeenCalled();act(()=>root.unmount());el.remove();
});
