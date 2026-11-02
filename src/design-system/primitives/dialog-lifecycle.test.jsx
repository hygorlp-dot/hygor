import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {Modal} from '../../legacy/ui.jsx';
import {Dialog} from './Dialog.jsx';
import {Drawer} from './Drawer.jsx';
import {SaveRecoveryContext} from '../../features/workflow/SaveRecoveryContext.jsx';
let root,container;
beforeEach(()=>vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener(){},removeEventListener(){}}))));
afterEach(()=>{act(()=>root?.unmount());container?.remove();root=null;container=null;document.body.style.overflow='';vi.unstubAllGlobals();});
function mount(ui){container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(ui));}
const escape=()=>act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
it.each([Dialog,Drawer])('fecha somente a sobreposição superior e preserva scroll bloqueado',async Component=>{
 document.body.style.overflow='auto';
 function App(){const [outer,setOuter]=useState(true),[inner,setInner]=useState(false);return outer?<Modal title="Principal" onClose={()=>setOuter(false)}><button onClick={()=>setInner(true)}>Abrir revisão</button><Component open={inner} onOpenChange={setInner} title="Revisão"><input aria-label="Valor" defaultValue="Preservado"/></Component></Modal>:<p>Concluído</p>;}
 mount(<App/>);act(()=>document.querySelector('button:not([aria-label])').click());
 expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);expect(document.body.style.overflow).toBe('hidden');
 escape();expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);expect(document.body.style.overflow).toBe('hidden');
 escape();expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);expect(document.body.style.overflow).toBe('auto');
});
it('edição recuperada desabilita conteúdo e footer, mantendo Fechar acessível',()=>{
 function Scene({revision}){return <SaveRecoveryContext.Provider value={{revision}}><Modal title="Editar" onClose={()=>{}} footer={<button>Gravar no footer</button>}><input aria-label="Nome" defaultValue="Original"/></Modal></SaveRecoveryContext.Provider>;}
 mount(<Scene revision={0}/>);act(()=>root.render(<Scene revision={1}/>));
 expect(document.querySelector('input').matches(':disabled')).toBe(true);expect([...document.querySelectorAll('button')].find(b=>b.textContent==='Gravar no footer').matches(':disabled')).toBe(true);expect(document.querySelector('button[aria-label="Fechar"]').matches(':disabled')).toBe(false);
});
