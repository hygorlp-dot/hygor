import {afterEach,beforeEach,expect,it} from 'vitest';
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {WorkContextStamp} from './WorkContextStamp.jsx';
import {setWorkContextObra,useSyncedWorkObra,useWorkContextScreen,workContextObraId} from './work-context.js';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const obras=[{id:'a',name:'Alameda'},{id:'b',name:'Horizonte'}];
let container,root;
beforeEach(()=>{setWorkContextObra('');container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();setWorkContextObra('');});

function Tela({inicial='a',allValue=null,fixed='',fixedShows}){
  const [obraId,setObraId]=useState(inicial);
  useSyncedWorkObra(obraId,setObraId,{allowedIds:['a','b'],allValue,fixed,fixedShows});
  return <output data-testid="tela">{obraId}</output>;
}
function DetalheDaObra({children}){useWorkContextScreen({mode:'locked',obraId:'b',allowAll:false});return children;}
const topo=()=>container.querySelector('[data-testid="work-context-stamp"]');
const select=()=>topo()?.querySelector('select');
const opcoes=()=>[...select().options].map(o=>o.textContent);

it('sem tela que siga o carimbo, o topo não aparece',()=>{
  act(()=>root.render(<WorkContextStamp obras={obras}/>));
  expect(topo()).toBeNull();
});

it('tela de uma obra só com o carimbo vazio: o topo mostra a obra da tela, sem "Todas"',()=>{
  act(()=>root.render(<><WorkContextStamp obras={obras}/><Tela/></>));
  expect(select().value).toBe('a');
  expect(opcoes()).not.toContain('Todas as obras');
  // A escolha automática da tela continua fora do carimbo.
  expect(workContextObraId()).toBe('');
  // Trocar no topo leva a tela junto.
  act(()=>{select().value='b';select().dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.querySelector('[data-testid="tela"]').textContent).toBe('b');
  expect(select().value).toBe('b');
});

it('tela que aceita "Todas": o topo mostra "Todas as obras" quando a tela está em todas',()=>{
  act(()=>root.render(<><WorkContextStamp obras={obras}/><Tela inicial="all" allValue="all"/></>));
  expect(select().value).toBe('');
  expect(opcoes()).toContain('Todas as obras');
});

it('dentro da obra o topo mostra só o nome, e o detalhe manda nas abas filhas',()=>{
  act(()=>root.render(<><WorkContextStamp obras={obras}/><DetalheDaObra><Tela/></DetalheDaObra></>));
  expect(select()).toBeNull();
  expect(topo().textContent).toContain('Horizonte');
});

it('com a tela travada por uma ação em curso, o topo mostra a obra da tela sem deixar trocar',()=>{
  act(()=>root.render(<><WorkContextStamp obras={obras}/><Tela inicial="b" fixed="ocupado" fixedShows="local"/></>));
  expect(select().value).toBe('b');
  expect(select().disabled).toBe(true);
});

it('ao fechar a tela, o topo some',()=>{
  act(()=>root.render(<><WorkContextStamp obras={obras}/><Tela/></>));
  expect(topo()).not.toBeNull();
  act(()=>root.render(<WorkContextStamp obras={obras}/>));
  expect(topo()).toBeNull();
});
