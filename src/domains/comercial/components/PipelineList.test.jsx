import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import {PipelineList,pipelineRows} from './PipelineList.jsx';
vi.mock('../../../hooks/useBreakpoint.js',()=>({useBreakpoint:()=>({isMobile:false})}));
let host,root;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;});
const lead={id:'a',nome:'João · serviço com identificação completa',etapa:'novo',proximaAtividadeEm:'2026-11-01',etapaDesde:'2026-10-01'};
function render(onMove){host=document.createElement('div');document.body.append(host);root=createRoot(host);act(()=>root.render(<PipelineList leads={[lead]} users={[]} onMove={onMove} onOpen={vi.fn()}/>));const select=host.querySelector('select[aria-label]')||[...host.querySelectorAll('select')].at(-1);const target=[...host.querySelectorAll('select')].find(e=>[...e.options].some(o=>o.value==='primeiro_contato'));act(()=>{target.value='primeiro_contato';target.dispatchEvent(new Event('change',{bubbles:true}));});return [...host.querySelectorAll('button')].find(b=>b.textContent==='Mover lead');}
it('filtra por contato e urgência sem alterar os dados',()=>{const leads=[lead,{...lead,id:'b',nome:'Outra',proximaAtividadeEm:'2027-01-01'}],before=JSON.stringify(leads);expect(pipelineRows(leads,'joao','overdue',Date.parse('2026-11-17')).map(l=>l.id)).toEqual(['a']);expect(JSON.stringify(leads)).toBe(before);});
it('selecionar não grava e um toque repetido não duplica a mudança em andamento',async()=>{let resolve;const move=vi.fn(()=>new Promise(r=>{resolve=r;}));const button=render(move);expect(move).not.toHaveBeenCalled();act(()=>{button.click();button.click();});expect(move).toHaveBeenCalledOnce();expect(move).toHaveBeenCalledWith(lead,'primeiro_contato');await act(async()=>resolve(true));});
it('permite tentar novamente após falha, sem exceção de página',async()=>{const move=vi.fn(async()=>{throw Error('offline');});const button=render(move);await act(async()=>button.click());expect(host.querySelector('[role=alert]').textContent).toContain('Não foi possível confirmar');expect(button.disabled).toBe(false);});
