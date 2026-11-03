import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import HelpPanel from './HelpPanel.jsx';
import {HelpProvider,useHelpTopic,useCurrentHelpTopic} from './HelpContext.jsx';

let root,container;
function mount(ui){container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(ui));}
afterEach(()=>{act(()=>root?.unmount());container?.remove();});
it('abre o fluxo da tela, limita o índice ao acesso e permite fechar com Escape',()=>{
 const close=vi.fn();
 mount(<HelpPanel id="help-test" pageId="ponto" topicId="ponto" allowedTabs={['home','ponto']} onClose={close}/>);
 expect(container.querySelector('article').textContent).toContain('Ponto por obra');
 expect(container.querySelectorAll('article li')).toHaveLength(3);
 const buttons=[...container.querySelectorAll('button')];
 act(()=>buttons.find(button=>button.textContent.includes('Manual completo')).click());
 const index=container.querySelector('.app-help-index');
 expect(index.textContent).toContain('Ponto por obra');
 expect(index.textContent).not.toContain('DRE empresa');
 act(()=>container.querySelector('h2').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(close).toHaveBeenCalledOnce();
});
it('acompanha a área interna e remove o contexto quando ela desmonta',()=>{
 function Area(){useHelpTopic('cmp','cmp_recebimentos');return null;}
 function Read(){return <output>{useCurrentHelpTopic('cmp')}</output>;}
 mount(<HelpProvider><Area/><Read/></HelpProvider>);
 expect(container.querySelector('output').textContent).toBe('cmp_recebimentos');
 act(()=>root.render(<HelpProvider><Read/></HelpProvider>));
 expect(container.querySelector('output').textContent).toBe('cmp');
});
it('resolve a etapa de compras quando ela está dentro de uma obra',()=>{
 function Area(){useHelpTopic('obras','cmp');useHelpTopic('cmp','cmp_recebimentos');return null;}
 function Read(){return <output>{useCurrentHelpTopic('obras')}</output>;}
 mount(<HelpProvider><Area/><Read/></HelpProvider>);
 expect(container.querySelector('output').textContent).toBe('cmp_recebimentos');
});

it('restaura o guia da área ao fechar a ficha, mesmo após o pai trocar de tópico',()=>{
 function Area({topic}){useHelpTopic('fin',topic);return null;}
 function Ficha(){useHelpTopic('fin','fin_ficha',10);return null;}
 function Current(){return <output>{useCurrentHelpTopic('fin')}</output>;}
 const view=(open,topic)=><HelpProvider>{open&&<Ficha/>}<Area topic={topic}/><Current/></HelpProvider>;
 mount(view(true,'fin_hoje'));expect(container.querySelector('output').textContent).toBe('fin_ficha');
 act(()=>root.render(view(true,'fin_documentos')));expect(container.querySelector('output').textContent).toBe('fin_ficha');
 act(()=>root.render(view(false,'fin_documentos')));expect(container.querySelector('output').textContent).toBe('fin_documentos');
});
