import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {ReportIdentityDialog} from './ReportIdentityDialog.jsx';
import {openReportPreview} from './report-preview.js';
import {HelpProvider} from '../features/help/HelpContext.jsx';
import {loadReportIdentity} from './report-identities.js';

vi.mock('./report-identities.js',()=>({MARCELL_REPORT_IDENTITY:{id:'marcell',name:'MARCELL',logo:'data:image/webp;base64,bXJj'},loadReportIdentity:vi.fn()}));
const arcd={id:'arcd',name:'ARCD',logo:'data:image/png;base64,YXJjZA=='};
const html='<html><head><title>Conferência</title></head><body><h1>Empresa cadastrada</h1><p>CNPJ 12.345.678/0001-90</p><table><tr><td>R$ 123,45</td></tr></table></body></html>';
let root,host,open;
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const loaded=async()=>act(async()=>{document.querySelector('figure img')?.dispatchEvent(new Event('load'));});
beforeEach(async()=>{
 loadReportIdentity.mockImplementation(id=>Promise.resolve(id==='arcd'?arcd:{id:'marcell',name:'MARCELL',logo:'data:image/webp;base64,bXJj'}));
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(<HelpProvider><button id="report-trigger" onClick={()=>openReportPreview(html)}>Preparar PDF</button><ReportIdentityDialog pageId="fin" allowedTabs={['fin']}/></HelpProvider>));
 open=vi.spyOn(window,'open').mockReturnValue({document:{open:vi.fn(),write:vi.fn(),close:vi.fn()},focus:vi.fn(),close:vi.fn(),print:vi.fn()});
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();});
async function prepare(){await act(async()=>{document.getElementById('report-trigger').focus();button('Preparar PDF').click();});}
it('aguarda confirmação e imagem, conserva os dados e gera uma única janela no clique',async()=>{
 await prepare();expect(open).not.toHaveBeenCalled();expect(button('Gerar relatório').disabled).toBe(true);
 await loaded();await act(async()=>{button('Gerar relatório').click();button('Gerar relatório')?.click();});
 expect(open).toHaveBeenCalledTimes(1);const text=open.mock.results[0].value.document.write.mock.calls[0][0];expect(text).toContain('data-report-identity="marcell"');expect(text).toContain('CNPJ 12.345.678/0001-90');expect(text).toContain('R$ 123,45');
});
it('troca a prévia para ARCD e aplica a mesma imagem ao cabeçalho e marca d’água',async()=>{
 await prepare();await act(async()=>{const select=document.querySelector('select');select.value='arcd';select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(document.querySelector('figure img').alt).toBe('Logomarca ARCD');await loaded();await act(async()=>button('Gerar relatório').click());
 const doc=new DOMParser().parseFromString(open.mock.results[0].value.document.write.mock.calls[0][0],'text/html');expect(doc.body.dataset.reportIdentity).toBe('arcd');expect(doc.querySelector('.mrc-report-logo').src).toBe(arcd.logo);expect(doc.querySelector('.mrc-report-watermark img').src).toBe(arcd.logo);
});
it('cancelar não abre janela e devolve o foco à consulta',async()=>{
 await prepare();await act(async()=>button('Cancelar').click());expect(open).not.toHaveBeenCalled();expect(document.querySelector('[role=dialog]')).toBeNull();expect(document.activeElement.id).toBe('report-trigger');
});
it('bloqueio de popup conserva a escolha para nova tentativa e permite cancelar',async()=>{
 open.mockReturnValue(null);await prepare();await loaded();await act(async()=>button('Gerar relatório').click());expect(document.querySelector('[role=alert]').textContent).toContain('Permita abrir janelas');expect(document.querySelector('select').value).toBe('marcell');await act(async()=>button('Cancelar').click());
});
it('falha da logomarca bloqueia geração e oferece nova tentativa',async()=>{
 loadReportIdentity.mockRejectedValue(new Error('Falha de teste da logomarca'));await prepare();expect(document.querySelector('[role=alert]').textContent).toContain('Falha de teste');expect(button('Gerar relatório').disabled).toBe(true);expect(open).not.toHaveBeenCalled();expect(button('Tentar carregar logomarca novamente')).toBeDefined();
});

it('ignora segunda solicitação pendente para não duplicar efeitos do chamador',async()=>{
 await prepare();const repeated=openReportPreview(html);expect(await repeated).toBeNull();expect(open).not.toHaveBeenCalled();await loaded();await act(async()=>button('Gerar relatório').click());expect(open).toHaveBeenCalledTimes(1);
});
