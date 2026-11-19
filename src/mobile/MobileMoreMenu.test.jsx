import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {Dialog} from '../design-system/primitives/Dialog.jsx';
import {SaveRecoveryContext} from '../features/workflow/SaveRecoveryContext.jsx';
import {MobileMoreMenu} from './MobileMoreMenu.jsx';

it('keeps navigation available as recovery invalidates an open editor',()=>{
  const host=document.createElement('div');
  document.body.append(host);
  const root=createRoot(host);
  const navigate=vi.fn();
  const close=vi.fn();
  const render=revision=>act(()=>root.render(
    <SaveRecoveryContext.Provider value={{revision}}>
      <Dialog open title="Editor"><button>Salvar edição</button></Dialog>
      <MobileMoreMenu open items={[{id:'com',label:'Comercial'}]} onNavigate={navigate} onOpenChange={close}/>
    </SaveRecoveryContext.Provider>
  ));
  try{
    render(0);
    render(1);
    const button=[...document.querySelectorAll('button')].find(node=>node.textContent==='Comercial');
    const editor=[...document.querySelectorAll('button')].find(node=>node.textContent==='Salvar edição');
    expect(editor.matches(':disabled')).toBe(true);
    expect(button.matches(':disabled')).toBe(false);
    expect(button.closest('[role=dialog]').textContent).not.toContain('Edição atualizada');
    act(()=>button.click());
    expect(navigate).toHaveBeenCalledWith('com');
    expect(close).toHaveBeenCalledWith(false);
  }finally{
    act(()=>root.unmount());
    host.remove();
  }
});
