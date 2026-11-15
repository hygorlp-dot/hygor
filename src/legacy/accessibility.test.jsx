import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it} from 'vitest';
import {Btn,Ic} from './ui.jsx';
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();});
it('o motivo da indisponibilidade não substitui o texto da ação e ícones continuam nomeados',()=>{
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<><Btn disabled title="Selecione uma obra para usar ações em lote">Todos presentes</Btn><Btn iconOnly title="Fechar"><Ic n="x"/></Btn><Btn title="Detalhes" ariaLabel="Salvar rascunho">Salvar</Btn></>));
  const [action,icon,explicit]=container.querySelectorAll('button');
  expect(action.getAttribute('aria-label')).toBeNull();
  expect(action.title).toBe('Selecione uma obra para usar ações em lote');
  expect(action.textContent).toBe('Todos presentes');
  expect(action.disabled).toBe(true);
  expect(icon.getAttribute('aria-label')).toBe('Fechar');
  expect(explicit.getAttribute('aria-label')).toBe('Salvar rascunho');
});
