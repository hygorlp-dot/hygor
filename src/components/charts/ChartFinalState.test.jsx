import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import ChartFinalState from './ChartFinalState.jsx';
let root,container;
afterEach(()=>{act(()=>root?.unmount());container?.remove();root=null;container=null;});
function render(ui){if(!container){container=document.createElement('div');document.body.append(container);root=createRoot(container);}act(()=>root.render(ui));}
it('publica quadro final e não repete conclusão por identidade nova do mesmo destino',()=>{
 let frames=0;const done=vi.fn();render(<ChartFinalState to={{t:1}} onAnimationEnd={done}>{({t})=>{frames++;return <span>{t}</span>;}}</ChartFinalState>);
 expect(container.textContent).toBe('1');expect(done).toHaveBeenCalledTimes(1);
 render(<ChartFinalState to={{t:1}} onAnimationEnd={done}>{({t})=><span>{t}</span>}</ChartFinalState>);
 expect(done).toHaveBeenCalledTimes(1);expect(frames).toBe(1);
});
it('conserva estilo do elemento e aplica valores finais',()=>{
 render(<ChartFinalState to={{opacity:1}}><span style={{color:'red',opacity:0}}>Dado final</span></ChartFinalState>);
 expect(container.firstChild.style.opacity).toBe('1');expect(container.firstChild.style.color).toBe('red');
});
