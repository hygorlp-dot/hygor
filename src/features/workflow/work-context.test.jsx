import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {obraContextoSalvo} from '../../legacy/format.js';
import {setWorkContextObra,useSyncedWorkObra,useWorkContextObra,workContextObraId} from './work-context.js';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let container,root;
beforeEach(()=>{setWorkContextObra('');container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();setWorkContextObra('');});

function Tela({fixed='',allowedIds=['a','b'],inicial='a',allValue=null}){
  const [obraId,setObraId]=useState(inicial);
  useSyncedWorkObra(obraId,setObraId,{allowedIds,fixed,allValue});
  const carimbo=useWorkContextObra();
  return <div><output data-testid="tela">{obraId}</output><output data-testid="carimbo">{carimbo}</output>
    <button onClick={()=>setObraId('b')}>trocar na tela</button><button onClick={()=>setObraId('all')}>todas</button></div>;
}
const texto=id=>container.querySelector(`[data-testid="${id}"]`).textContent;

describe('carimbo de contexto da obra',()=>{
  it('grava na mesma chave lida por obraContextoSalvo',()=>{
    setWorkContextObra('obra-1');
    expect(workContextObraId()).toBe('obra-1');expect(obraContextoSalvo()).toBe('obra-1');
    setWorkContextObra('');expect(obraContextoSalvo()).toBe('');
  });

  it('a tela segue o carimbo e o carimbo segue a tela',()=>{
    setWorkContextObra('a');
    act(()=>root.render(<Tela/>));
    expect(texto('carimbo')).toBe('a');
    act(()=>setWorkContextObra('b'));
    expect(texto('tela')).toBe('b');
    act(()=>setWorkContextObra('a'));
    act(()=>container.querySelector('button').click());
    expect(texto('tela')).toBe('b');expect(texto('carimbo')).toBe('b');
  });

  it('ignora obra fora das aceitas pela tela',()=>{
    act(()=>root.render(<Tela/>));
    act(()=>setWorkContextObra('z'));
    expect(texto('tela')).toBe('a');
  });

  it('no detalhe de uma obra a obra fixa manda e o carimbo não muda',()=>{
    setWorkContextObra('b');
    act(()=>root.render(<Tela fixed="a" inicial="a"/>));
    expect(texto('tela')).toBe('a');expect(workContextObraId()).toBe('b');
  });
  it('tela de uma obra não grava a escolha automática com o carimbo vazio',()=>{
    act(()=>root.render(<Tela/>));
    expect(texto('tela')).toBe('a');expect(workContextObraId()).toBe('');
    act(()=>container.querySelector('button').click());
    expect(workContextObraId()).toBe('b');
  });

  it('tela de várias obras: carimbo vazio é "todas" e "todas" limpa o carimbo',()=>{
    setWorkContextObra('b');
    act(()=>root.render(<Tela allValue="all" inicial="all"/>));
    expect(texto('tela')).toBe('b');
    act(()=>setWorkContextObra(''));
    expect(texto('tela')).toBe('all');
    act(()=>setWorkContextObra('a'));
    expect(texto('tela')).toBe('a');
    act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='todas').click());
    expect(workContextObraId()).toBe('');
  });
});

