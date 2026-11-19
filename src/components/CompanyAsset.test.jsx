import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {CompanyAssetImage,CompanyAssetLink} from './CompanyAsset.jsx';
const state=vi.hoisted(()=>({key:'arcd:1',resolve:vi.fn()}));
vi.mock('../api.js',()=>({assetAuthorizationKey:()=>state.key,protectedCompanyAsset:v=>String(v).startsWith('company-file:'),resolveCompanyAssetUrl:(...args)=>state.resolve(...args)}));
let host,root;
beforeEach(()=>{state.key='arcd:1';state.resolve.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
const reference='company-file://arcd/work/2026/35136ece-8161-4cb3-89a2-b9d6a4ad470c.jpg';
it('não envia a referência privada como src e apresenta a URL autorizada',async()=>{
 let finish;state.resolve.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));await act(async()=>root.render(<CompanyAssetImage src={reference} alt="Foto da obra"/>));
 expect(host.querySelector('img').getAttribute('src')).toBeNull();
 await act(async()=>finish({ok:true,url:'https://storage.test/temporary'}));expect(host.querySelector('img').getAttribute('src')).toBe('https://storage.test/temporary');
});
it('oculta imediatamente a imagem anterior quando muda empresa ou usuário',async()=>{
 state.resolve.mockResolvedValueOnce({ok:true,url:'https://storage.test/arcd'}).mockImplementation(()=>new Promise(()=>{}));
 await act(async()=>root.render(<CompanyAssetImage src={reference} alt="Foto"/>));expect(host.querySelector('img').getAttribute('src')).toBe('https://storage.test/arcd');
 state.key='mrc:2';await act(async()=>root.render(<CompanyAssetImage src={reference} alt="Foto"/>));expect(host.querySelector('img').getAttribute('src')).toBeNull();
});
it('nega falha sem recorrer a URL pública e mantém links desativados',async()=>{
 state.resolve.mockResolvedValue({ok:false,error:'Arquivo indisponível para este acesso.'});await act(async()=>root.render(<><CompanyAssetImage src={reference} alt="Foto"/><CompanyAssetLink href={reference}>Arquivo</CompanyAssetLink></>));
 expect(host.querySelector('img').alt).toBe('Foto — indisponível');expect(host.querySelector('img').getAttribute('src')).toBeNull();
 expect(host.querySelector('a').getAttribute('href')).toBeNull();expect(host.querySelector('a').getAttribute('aria-disabled')).toBe('true');
});
