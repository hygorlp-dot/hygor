import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {loadPreviewResource} from './preview-resource.js';
import RevisionPane from './RevisionPane.jsx';
vi.mock('../../api.js',()=>({obterLinkArquivoOneDrive:vi.fn(),lerArquivoOneDrive:vi.fn()}));
vi.mock('./preview-resource.js',()=>({loadPreviewResource:vi.fn()}));
let root,el;
beforeEach(()=>{vi.useFakeTimers();el=document.createElement('div');document.body.append(el);root=createRoot(el);vi.mocked(loadPreviewResource).mockReset();});
afterEach(()=>{act(()=>root.unmount());el.remove();vi.useRealTimers();});
it('encerra a espera no erro, mantém a revisão identificada e permite tentar novamente',async()=>{
 let reject;vi.mocked(loadPreviewResource).mockImplementationOnce(()=>new Promise((_,r)=>reject=r)).mockImplementationOnce(()=>new Promise(()=>{}));act(()=>root.render(<RevisionPane revision={{label:'R01',note:'Revisão original'}} name="Planta"/>));act(()=>vi.advanceTimersByTime(200));expect(el.querySelector('[role=status]').getAttribute('aria-label')).toBe('Carregando documento…');await act(async()=>reject(new Error('Arquivo indisponível nesta conexão.')));expect(el.querySelector('[role=status]')).toBeNull();expect(el.querySelector('[role=alert]').textContent).toContain('Arquivo indisponível');expect(el.querySelector('h3').textContent).toBe('R01');act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Tentar novamente').click());act(()=>vi.advanceTimersByTime(200));expect(loadPreviewResource).toHaveBeenCalledTimes(2);expect(el.querySelector('[role=status]')).toBeTruthy();const signal=vi.mocked(loadPreviewResource).mock.calls[1][1].signal;act(()=>root.render(null));expect(signal.aborted).toBe(true);
});
