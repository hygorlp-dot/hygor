import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect} from 'vitest';
import {ProgressPercentageField} from './ProgressPercentageField.jsx';
let root,host,values=[];
afterEach(()=>{act(()=>root?.unmount());host?.remove();values=[];});
function Harness(){const [value,setValue]=useState('34.4826');return <ProgressPercentageField label="Percentual de Estrutura" value={value} previous={17.2414} onChange={v=>{values.push(v);setValue(v);}}/>;}
function render(){host=document.createElement('div');document.body.append(host);root=createRoot(host);act(()=>root.render(<Harness/>));return host.querySelector('input[type=text]');}
it('simplifica a leitura sem arredondar o valor ao abrir, focar ou sair do campo',()=>{const input=render();expect(input.value).toBe('34,48');expect(host.textContent).toContain('Anterior: 17,24%');act(()=>input.focus());expect(input.value).toBe('34,4826');act(()=>input.blur());expect(input.value).toBe('34,48');expect(values).toEqual([]);});
it('aceita vírgula decimal e guarda o número completo para o cálculo',()=>{const input=render();act(()=>input.focus());act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'35,91234');input.dispatchEvent(new Event('input',{bubbles:true}));});expect(values.at(-1)).toBe('35.91234');act(()=>input.blur());expect(input.value).toBe('35,91');expect(values.at(-1)).toBe('35.91234');});
it('cancelar o gesto de rolagem no slider recupera a precisão original',()=>{render();const range=host.querySelector('input[type=range]');act(()=>{const down=new Event('pointerdown',{bubbles:true});Object.defineProperty(down,'pointerType',{value:'touch'});range.dispatchEvent(down);});act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(range,'40.01');range.dispatchEvent(new Event('input',{bubbles:true}));});act(()=>range.dispatchEvent(new Event('pointercancel',{bubbles:true})));expect(values.at(-1)).toBe('34.4826');});
