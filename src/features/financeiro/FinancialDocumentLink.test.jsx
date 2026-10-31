import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import FinancialDocumentLink from './FinancialDocumentLink.jsx';
import {protectedDocumentReference} from '../../domains/financeiro/document-links.js';
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();vi.restoreAllMocks();});
const render=props=>{container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(<FinancialDocumentLink {...props}>Nota original</FinancialDocumentLink>));};
const href='/api/microsoft/onedrive?action=file&driveId=drive&itemId=original&sig=expired';
it('renova o link assinado antes de abrir e usa as referências do arquivo original',async()=>{
 const popup={opener:{},location:{replace:vi.fn()},close:vi.fn()};vi.spyOn(window,'open').mockReturnValue(popup);
 const resolveFile=vi.fn(async()=>({ok:true,url:href.replace('expired','fresh')}));render({href,resolveFile});
 await act(async()=>container.querySelector('a').click());
 expect(resolveFile).toHaveBeenCalledWith({driveId:'drive',itemId:'original'});
 expect(popup.opener).toBeNull();expect(popup.location.replace).toHaveBeenCalledWith(href.replace('expired','fresh'));
 expect(container.querySelector('[role=alert]')).toBeNull();
});
it('informa original ausente sem navegar para link vencido e permite tentar de novo',async()=>{
 const popup={location:{replace:vi.fn()},close:vi.fn()};vi.spyOn(window,'open').mockReturnValue(popup);
 const resolveFile=vi.fn(async()=>({ok:false,status:404}));render({href,resolveFile});
 await act(async()=>container.querySelector('a').click());
 expect(container.querySelector('[role=alert]').textContent).toContain('Original não encontrado');
 expect(popup.close).toHaveBeenCalled();expect(popup.location.replace).not.toHaveBeenCalled();
 await act(async()=>container.querySelector('a').click());expect(resolveFile).toHaveBeenCalledTimes(2);
});
it('mantém links externos e recusa referências de rotas executáveis',()=>{
 render({href:'https://example.com/nf.pdf'});expect(container.querySelector('a').href).toBe('https://example.com/nf.pdf');
 expect(protectedDocumentReference(href)).toEqual({driveId:'drive',itemId:'original'});
 for(const value of ['javascript:alert(1)','/api/data','/api/microsoft/onedrive?action=upload&driveId=a&itemId=b'])expect(protectedDocumentReference(value)).toBeNull();
});
it('explica bloqueio de popup sem consumir consulta ao OneDrive',async()=>{
 vi.spyOn(window,'open').mockReturnValue(null);const resolveFile=vi.fn();render({href,resolveFile});
 await act(async()=>container.querySelector('a').click());
 expect(resolveFile).not.toHaveBeenCalled();expect(container.querySelector('[role=alert]').textContent).toContain('Permita abrir uma nova aba');
});
