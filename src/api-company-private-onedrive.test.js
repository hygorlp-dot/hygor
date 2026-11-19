import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();vi.resetModules();});
const reference='/api/microsoft/onedrive?action=file&companyId=arcd&driveId=drive&itemId=item&sig=obsolete';
async function setup(){
 const create=vi.fn(()=> 'blob:private-company-file');
 vi.stubGlobal('URL',class extends URL{static createObjectURL=create;});
 const api=await import('./api.js'),scope=await import('./lib/company-scope.js');
 api.abrirSessao('admin','1234');scope.setCompanyIsolation(true);return {api,scope,create};
}
it('lê o binário com a sessão e não usa GET nem a assinatura persistida',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('private bytes',{headers:{'content-type':'image/jpeg'}}));vi.stubGlobal('fetch',fetch);
 const {api,create}=await setup();
 expect(await api.resolveCompanyAssetUrl(reference)).toEqual({ok:true,url:'blob:private-company-file',temporaryObjectUrl:true});
 expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][0]).toBe('/api/microsoft/onedrive');
 expect(fetch.mock.calls[0][1].method).toBe('POST');expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({action:'read-file',companyId:'arcd',userId:'admin',driveId:'drive',itemId:'item'});
 expect(create).toHaveBeenCalledTimes(1);
});
it('descarta leitura que terminou depois de trocar de empresa',async()=>{
 let finish;vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve;})));
 const {api,scope,create}=await setup();const reading=api.resolveCompanyAssetUrl(reference);scope.setActiveCompany('mrc');finish(new Response('ARCD bytes'));
 expect((await reading).ok).toBe(false);expect(create).not.toHaveBeenCalled();
});
it('mantém negado o arquivo sem autorização e não cria URL local',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'Sem acesso'}),{status:403})));
 const {api,create}=await setup();expect(await api.resolveCompanyAssetUrl(reference)).toMatchObject({ok:false,error:'Sem acesso'});expect(create).not.toHaveBeenCalled();
});
it('trata falha de rede sem recorrer ao link antigo',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('network')));
 const {api,create}=await setup();expect((await api.resolveCompanyAssetUrl(reference)).ok).toBe(false);expect(create).not.toHaveBeenCalled();
});
it('abre documentos legados pelo mesmo acesso autenticado',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('document bytes',{headers:{'content-type':'application/pdf'}}));vi.stubGlobal('fetch',fetch);
 const {api}=await setup();expect(await api.obterLinkArquivoOneDrive({driveId:'drive',itemId:'item'})).toMatchObject({ok:true,url:'blob:private-company-file'});
 expect(JSON.parse(fetch.mock.calls[0][1].body).action).toBe('read-file');
});
it('mantém HTML e SVG inertes quando abertos como anexos locais',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}})));
 const {api,create}=await setup();expect((await api.resolveCompanyAssetUrl(reference)).ok).toBe(true);expect(create.mock.calls[0][0].type).toBe('application/octet-stream');
});
