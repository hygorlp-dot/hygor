import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {ReportIdentityDialog} from './ReportIdentityDialog.jsx';
import {openReportPreview} from './report-preview.js';
import {HelpProvider} from '../features/help/HelpContext.jsx';
import {loadReportFonts} from './report-fonts.js';
import {MARCELL_LOGO} from '../brand/identity.js';

vi.mock('./report-fonts.js',()=>({loadReportFonts:vi.fn(),readReportFonts:()=>({regularFont:'data:font/woff2;base64,cmVndWxhcg==',boldFont:'data:font/woff2;base64,Ym9sZA=='})}));
const html='<html><head><title>Conferência</title></head><body><h1>Empresa cadastrada</h1><p>CNPJ 12.345.678/0001-90</p><table><tr><td>R$ 123,45</td></tr></table></body></html>';
let root,host,open;
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const loaded=async()=>act(async()=>{document.querySelector('figure img')?.dispatchEvent(new Event('load'));});
beforeEach(async()=>{
 loadReportFonts.mockResolvedValue({});
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
it('mostra somente a prévia MARCELL e a aplica ao cabeçalho e à marca d’água',async()=>{
 await prepare();expect(document.querySelector('[role=dialog] select')).toBeNull();
 expect(document.querySelector('figure img').alt).toBe('Logomarca MARCELL');
 await loaded();await act(async()=>button('Gerar relatório').click());
 const doc=new DOMParser().parseFromString(open.mock.results[0].value.document.write.mock.calls[0][0],'text/html');
 expect(doc.body.dataset.reportIdentity).toBe('marcell');
 expect(doc.querySelector('.mrc-report-logo').src).toBe(MARCELL_LOGO);
 expect(doc.querySelector('.mrc-report-watermark img').src).toBe(MARCELL_LOGO);
});
it('cancelar não abre janela e devolve o foco à consulta',async()=>{
 await prepare();await act(async()=>button('Cancelar').click());expect(open).not.toHaveBeenCalled();expect(document.querySelector('[role=dialog]')).toBeNull();expect(document.activeElement.id).toBe('report-trigger');
});
it('bloqueio de popup conserva a prévia e permite cancelar',async()=>{
 open.mockReturnValue(null);await prepare();await loaded();await act(async()=>button('Gerar relatório').click());expect(document.querySelector('[role=alert]').textContent).toContain('Permita abrir janelas');expect(document.querySelector('figure img').alt).toBe('Logomarca MARCELL');await act(async()=>button('Cancelar').click());
});
it('falha da logomarca bloqueia geração e oferece nova tentativa',async()=>{
 await prepare();
 await act(async()=>document.querySelector('figure img').dispatchEvent(new Event('error')));
 expect(document.querySelector('[role=alert]').textContent).toContain('Não foi possível exibir a logomarca');
 expect(button('Gerar relatório').disabled).toBe(true);expect(open).not.toHaveBeenCalled();
 await act(async()=>button('Tentar carregar novamente').click());await loaded();
 expect(button('Gerar relatório').disabled).toBe(false);
});

it('ignora segunda solicitação pendente para não duplicar efeitos do chamador',async()=>{
 await prepare();const repeated=openReportPreview(html);expect(await repeated).toBeNull();expect(open).not.toHaveBeenCalled();await loaded();await act(async()=>button('Gerar relatório').click());expect(open).toHaveBeenCalledTimes(1);
});

it('aguarda as fontes sem abrir popup nem habilitar a confirmação antecipadamente',async()=>{
 let release;loadReportFonts.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
 await prepare();expect(button('Gerar relatório').disabled).toBe(true);expect(open).not.toHaveBeenCalled();
 expect(document.querySelector('[role=status]').textContent).toContain('fontes');
 await act(async()=>release({}));await loaded();await act(async()=>button('Gerar relatório').click());expect(open).toHaveBeenCalledTimes(1);
});

it('falha de fonte impede a geração até carregar novamente',async()=>{
 loadReportFonts.mockRejectedValue(new Error('Falha das fontes de teste'));await prepare();
 expect(button('Gerar relatório').disabled).toBe(true);expect(open).not.toHaveBeenCalled();
 expect(document.querySelector('[role=alert]').textContent).toContain('fontes');
 loadReportFonts.mockResolvedValue({});await act(async()=>button('Tentar carregar novamente').click());await loaded();
 expect(document.querySelector('figure img').alt).toBe('Logomarca MARCELL');await act(async()=>button('Gerar relatório').click());expect(open).toHaveBeenCalledTimes(1);
});
