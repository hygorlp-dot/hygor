import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
const engine=vi.hoisted(()=>({getDocument:vi.fn()}));
vi.mock('pdfjs-dist',()=>({getDocument:engine.getDocument,GlobalWorkerOptions:{}}));
import PdfDocumentPreview from './PdfDocumentPreview.jsx';
let root,container;
afterEach(()=>{container?.remove();vi.unstubAllGlobals();engine.getDocument.mockReset();});
async function mount(){container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<PdfDocumentPreview url="https://example.test/proof.pdf" name="Comprovante" onError={vi.fn()}/>));}
it('cancela a rede antes de criar um worker quando o usuário sai durante o carregamento',async()=>{
 const request=vi.fn(()=>new Promise(()=>{}));vi.stubGlobal('fetch',request);
 await mount();await act(async()=>root.unmount());
 expect(request.mock.calls[0][1].signal.aborted).toBe(true);expect(engine.getDocument).not.toHaveBeenCalled();
});
it('libera o worker somente após a inicialização em memória encerrar',async()=>{
 let finish;const task={promise:new Promise(resolve=>{finish=resolve;}),destroy:vi.fn().mockResolvedValue(undefined)};
 engine.getDocument.mockReturnValue(task);vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}));
 await mount();expect(engine.getDocument.mock.calls[0][0].data).toBeInstanceOf(Uint8Array);
 await act(async()=>root.unmount());expect(task.destroy).not.toHaveBeenCalled();
 await act(async()=>finish({numPages:1}));expect(task.destroy).toHaveBeenCalledTimes(1);
});
