import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import DocumentEvidence from './DocumentEvidence.jsx';
let root,container;
afterEach(()=>{act(()=>root?.unmount());container?.remove();});
async function render(props){container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<DocumentEvidence {...props}/>));}
it('distingue sem anexo de anexo cadastrado sem endereço, sem tentar buscar',async()=>{
 const resolve=vi.fn();await render({documents:[],resolveFile:resolve});expect(container.textContent).toContain('Sem anexo cadastrado');
 await act(async()=>root.render(<DocumentEvidence documents={[{nome:'Comprovante'}]} resolveFile={resolve}/>));
 expect(container.textContent).toContain('Endereço indisponível');expect(container.querySelector('a')).toBeNull();expect(resolve).not.toHaveBeenCalled();
});
it('mantém o vínculo em caso de permissão negada e permite repetir a leitura',async()=>{
 const resolve=vi.fn().mockResolvedValueOnce({ok:false,status:403}).mockResolvedValueOnce({ok:true,url:'https://example.test/receipt.png'});
 await render({documents:[{nome:'Comprovante.png',driveId:'drive',id:'item'}],resolveFile:resolve});
 expect(container.textContent).toContain('Referência cadastrada');expect(container.textContent).toContain('Seu acesso não permite');
 await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='Tentar novamente').click());
 expect(container.querySelector('img').src).toBe('https://example.test/receipt.png');expect(resolve).toHaveBeenCalledTimes(2);
});
