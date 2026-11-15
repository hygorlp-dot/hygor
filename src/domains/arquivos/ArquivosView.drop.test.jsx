import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import ArquivosView from './ArquivosView.jsx';
import {enviarArquivoOneDrive} from '../../api.js';
vi.mock('../../api.js',()=>({enviarArquivoOneDrive:vi.fn()}));
vi.mock('./FilePreview.jsx',()=>({default:()=>null}));
vi.mock('../licenciamento/DossierView.jsx',()=>({default:()=>null}));
let el,root,dispatch,data;
const user={id:'admin',role:'admin',nome:'Admin'};
const find=text=>[...el.querySelectorAll('button')].find(b=>b.textContent===text);
function drop(files,target=el.querySelector('[aria-label="Documentos da obra"]')) {
  const event=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{types:['Files'],files}});act(()=>target.dispatchEvent(event));return event;
}
function mount(currentUser=user){act(()=>root.render(<ArquivosView data={data} currentUser={currentUser} dispatchCommand={dispatch} onRefresh={vi.fn()}/>));}
beforeEach(()=>{el=document.createElement('div');document.body.append(el);root=createRoot(el);dispatch=vi.fn(async()=>({ok:true}));data={obras:[{id:'w',name:'K1-10'}],workFileCabinets:[{obraId:'w',version:0,folders:[{id:'contrato',name:'CONTRATO',parentId:''}],documents:[],history:[]}]};});
afterEach(()=>{act(()=>root.unmount());el.remove();vi.clearAllMocks();});
it('soltar arquivo abre cadastro na pasta atual sem enviar ou gravar automaticamente',async()=>{
  mount();act(()=>find('CONTRATO').click());const file=new File(['contrato'],'contrato.pdf',{type:'application/pdf'});expect(drop([file]).defaultPrevented).toBe(true);
  expect(el.querySelector('input[maxlength="200"]').value).toBe('contrato.pdf');
  expect([...el.querySelectorAll('select')].some(s=>s.value==='contrato')).toBe(true);
  expect(el.textContent).toContain('contrato.pdf');expect(dispatch).not.toHaveBeenCalled();expect(enviarArquivoOneDrive).not.toHaveBeenCalled();
  enviarArquivoOneDrive.mockResolvedValue({ok:true,url:'https://example.org/f.pdf',item:{id:'item'},workspace:{driveId:'drive'}});
  await act(async()=>{el.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(dispatch).toHaveBeenCalledTimes(1));});
  expect(enviarArquivoOneDrive).toHaveBeenCalledTimes(1);expect(dispatch.mock.calls[0][0].payload).toMatchObject({folderId:'contrato',name:'contrato.pdf',kind:'file',fileName:'contrato.pdf',obraId:'w'});
});
it('bloqueia extensão inválida e arquivo grande sem perder o contexto',()=>{
  mount();for(const files of [[new File(['x'],'a.exe')],[new File([new Uint8Array(3*1024*1024+1)],'a.pdf')]]){drop(files);expect(el.querySelector('form')).toBeNull();expect(el.querySelector('[role="alert"]')).not.toBeNull();}expect(dispatch).not.toHaveBeenCalled();
});
it('respeita pasta somente leitura',()=>{
  data.workFileCabinets[0].folders[0].access={restricted:true,readers:['eng'],editors:[]};mount({id:'eng',role:'engenheiro',obraId:'w'});act(()=>find('CONTRATO').click());drop([new File(['x'],'a.pdf')]);expect(el.querySelector('form')).toBeNull();expect(dispatch).not.toHaveBeenCalled();expect(el.textContent).toContain('permissão');
});
it('cancelar após arrastar não faz upload',()=>{mount();drop([new File(['x'],'a.pdf')]);act(()=>find('Cancelar').click());expect(el.querySelector('form')).toBeNull();expect(enviarArquivoOneDrive).not.toHaveBeenCalled();});

it('lote envia vários arquivos com uma confirmação e retoma sem repetir envios confirmados',async()=>{
 mount();act(()=>find('CONTRATO').click());const files=[new File(['a'],'a.pdf'),new File(['b'],'b.pdf')];drop(files);
 expect(el.textContent).toContain('Adicionar arquivos em lote');expect(dispatch).not.toHaveBeenCalled();
 enviarArquivoOneDrive.mockResolvedValueOnce({ok:true,url:'https://example.org/a.pdf',item:{id:'a'}}).mockResolvedValueOnce({ok:false,error:'OneDrive indisponível'}).mockResolvedValueOnce({ok:true,url:'https://example.org/b.pdf',item:{id:'b'}});
 await act(async()=>{find('Enviar arquivos').click();await vi.waitFor(()=>expect(enviarArquivoOneDrive).toHaveBeenCalledTimes(2));});
 expect(dispatch).not.toHaveBeenCalled();expect(enviarArquivoOneDrive).toHaveBeenCalledTimes(2);
 await act(async()=>{find('Enviar arquivos').click();await vi.waitFor(()=>expect(dispatch).toHaveBeenCalledTimes(1));});
 expect(enviarArquivoOneDrive).toHaveBeenCalledTimes(3);expect(dispatch.mock.calls[0][0]).toMatchObject({type:'ARQUIVOS_LOTE_ADICIONADO',expectedVersion:0,payload:{obraId:'w',folderId:'contrato'}});
 expect(dispatch.mock.calls[0][0].payload.documents.map(d=>d.name)).toEqual(['a.pdf','b.pdf']);
});
it('cancelar um lote antes de enviar não altera documentos',()=>{mount();drop([new File(['x'],'a.pdf'),new File(['y'],'b.pdf')]);act(()=>find('Cancelar').click());expect(dispatch).not.toHaveBeenCalled();expect(enviarArquivoOneDrive).not.toHaveBeenCalled();});

it('resposta de gravação perdida permite repetir o mesmo lote após atualizar a versão',async()=>{
 mount();drop([new File(['a'],'a.pdf'),new File(['b'],'b.pdf')]);
 enviarArquivoOneDrive.mockResolvedValue({ok:true,url:'https://example.org/file.pdf',item:{id:'stored'}});
 dispatch.mockResolvedValueOnce({ok:false,reason:'Resposta perdida'}).mockResolvedValueOnce({ok:true});
 await act(async()=>{find('Enviar arquivos').click();await vi.waitFor(()=>expect(dispatch).toHaveBeenCalledTimes(1));});
 const first=dispatch.mock.calls[0][0];expect(first.idempotencyKey).toMatch(/^[a-zA-Z0-9_-]{16,200}$/);data={...data,workFileCabinets:[{...data.workFileCabinets[0],version:1}]};mount();
 await act(async()=>{find('Enviar arquivos').click();await vi.waitFor(()=>expect(dispatch).toHaveBeenCalledTimes(2));});
 expect(enviarArquivoOneDrive).toHaveBeenCalledTimes(2);expect(dispatch.mock.calls[1][0].idempotencyKey).toBe(first.idempotencyKey);expect(dispatch.mock.calls[1][0].expectedVersion).toBe(1);expect(dispatch.mock.calls[1][0].payload.documents).toEqual(first.payload.documents);
});
