import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import UserDirectory from './UserDirectory.jsx';
it('mantém ações administrativas ausentes para um operador sem perfil administrador',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el),edit=vi.fn();
 try{act(()=>root.render(<UserDirectory users={[{id:'u',nome:'Pessoa QA',role:'financeiro',active:true}]} works={[]} roles={[{v:'financeiro',l:'Financeiro'}]} currentUser={{id:'u',role:'financeiro'}} presences={new Map()} formatActivity={()=>'Sem registro'} onEdit={edit}/>));
 expect(el.textContent).toContain('Pessoa QA');expect(el.querySelector('button')).toBeNull();expect(el.querySelector('summary')).toBeNull();expect(edit).not.toHaveBeenCalled();
 expect(el.textContent).toContain('Vínculo de login não informado');expect(el.textContent).not.toContain('Login por e-mail não ativado');
 }finally{act(()=>root.unmount());el.remove();}
});
