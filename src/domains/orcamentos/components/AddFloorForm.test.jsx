import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import AddFloorForm from './AddFloorForm';
let root, container;
afterEach(()=>{act(()=>root?.unmount());container?.remove();});
it('coleta nome, nível e duas origens e envia uma única criação',()=>{
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  const onCreate=vi.fn();
  act(()=>root.render(<AddFloorForm budget={{etapas:[{id:'floor',nome:'1º PAVIMENTO'}]}} onCreate={onCreate} onCancel={()=>{}}/>));
  const inputs=container.querySelectorAll('input');
  const change=(input,value)=>act(()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  change(inputs[0],'2º pavimento');change(inputs[1],'6,00');
  const selects=container.querySelectorAll('select');
  act(()=>{selects[1].value='floor';selects[1].dispatchEvent(new Event('change',{bubbles:true}));});
  act(()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(onCreate).toHaveBeenCalledExactlyOnceWith({nome:'2º pavimento',nivel:'6,00',origem:'pavimento1',etapaId:'floor'});
  expect(container.textContent).toContain('quantitativos começam zerados');
});
