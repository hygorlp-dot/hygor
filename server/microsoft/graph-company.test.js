// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({sealed:null,upsert:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{value:{sealed:state.sealed}}}),upsert:state.upsert})})}));
vi.mock('../app-auth.js',()=>({authenticateAppContext:vi.fn()}));
beforeEach(()=>{
  vi.resetModules();state.sealed=null;state.upsert.mockReset();
  for(const [key,value]of Object.entries({COMPANY_ISOLATION_ENABLED:'true',SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test',MICROSOFT_CLIENT_ID:'client',MICROSOFT_CLIENT_SECRET:'secret',MICROSOFT_REDIRECT_URI:'https://test.invalid/callback',ONEDRIVE_ROOT_FOLDER_URL_MRC:'https://1drv.ms/mrc',ONEDRIVE_ROOT_FOLDER_URL_ARCD:'https://1drv.ms/arcd'}))vi.stubEnv(key,value);
  vi.stubGlobal('fetch',vi.fn());
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('sessão e arquivos Microsoft isolados',()=>{
  const driveId='A55D2E2D0945F9E2',itemId=driveId+'!sd4037d5321454f7baf88cb4bfaca6aff';
  const ownerUrl=`https://onedrive.live.com?cid=${driveId}&id=${itemId}`;
  it('abre uma raiz privada pelo ID sem exigir link de compartilhamento',async()=>{
    vi.stubEnv('ONEDRIVE_ROOT_FOLDER_URL_MRC',ownerUrl);
    fetch.mockResolvedValue(new Response(JSON.stringify({id:itemId,folder:{},parentReference:{driveId}})));
    const ms=await import('./graph.js'),{runWithCompany}=await import('../company-context.js');
    expect(await runWithCompany('mrc',()=>ms.rootItem('token'))).toMatchObject({id:itemId});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${encodeURIComponent(itemId)}?$select=id,name,folder,parentReference,webUrl,remoteItem`);
    expect(fetch.mock.calls[0][1].method).toBeUndefined();
  });
  it('bloqueia duas URLs diferentes que apontam para a mesma raiz',async()=>{
    vi.stubEnv('ONEDRIVE_ROOT_FOLDER_URL_MRC',ownerUrl);
    vi.stubEnv('ONEDRIVE_ROOT_FOLDER_URL_ARCD',`https://onedrive.live.com/?id=${encodeURIComponent(itemId)}&cid=${driveId.toLowerCase()}&view=0`);
    const ms=await import('./graph.js'),{runWithCompany}=await import('../company-context.js');
    await expect(runWithCompany('mrc',()=>ms.rootItem('token'))).rejects.toMatchObject({status:503});
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    {id:'other',folder:{},parentReference:{driveId}},
    {id:itemId,folder:{},parentReference:{driveId:'other'}},
    {id:itemId,file:{},parentReference:{driveId}},
    {id:itemId,folder:{},remoteItem:{id:'other'},parentReference:{driveId}},
  ])('recusa metadados divergentes da raiz privada: %j',async root=>{
    vi.stubEnv('ONEDRIVE_ROOT_FOLDER_URL_MRC',ownerUrl);
    fetch.mockResolvedValue(new Response(JSON.stringify(root)));
    const ms=await import('./graph.js'),{runWithCompany}=await import('../company-context.js');
    await expect(runWithCompany('mrc',()=>ms.rootItem('token'))).rejects.toMatchObject({status:503});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([undefined,'arcd'])('não usa sessão central sem vínculo correto (%s)',async companyId=>{
    const ms=await import('./graph.js'),{runWithCompany}=await import('../company-context.js');state.sealed=ms.seal({companyId,refreshToken:'do-not-use'});
    await expect(runWithCompany('mrc',()=>ms.refresh({headers:{}}))).rejects.toMatchObject({status:401});expect(fetch).not.toHaveBeenCalled();expect(state.upsert).not.toHaveBeenCalled();
  });
  it('bloqueia raiz repetida antes de consultar ou gravar no Graph',async()=>{
    vi.stubEnv('ONEDRIVE_ROOT_FOLDER_URL_MRC','https://1drv.ms/arcd');const ms=await import('./graph.js'),{runWithCompany}=await import('../company-context.js');
    await expect(runWithCompany('mrc',()=>ms.graph('token','/drives/shared/items/file/content'))).rejects.toMatchObject({status:503});expect(fetch).not.toHaveBeenCalled();
  });
  it('bloqueia leitura e exclusão fora da raiz, mesmo com drive compartilhado',async()=>{
    const ms=await import('./graph.js'),{runWithCompany}=await import('../company-context.js');
    fetch.mockImplementation(async url=>new Response(JSON.stringify(String(url).includes('/shares/')?{id:'mrc-root',parentReference:{driveId:'shared'}}:{id:'arcd-file',parentReference:{id:null}}),{headers:{'content-type':'application/json'}}));
    for(const method of ['GET','DELETE'])await expect(runWithCompany('mrc',()=>ms.graph('token','/drives/shared/items/arcd-file/content',{method}))).rejects.toMatchObject({status:403});
    expect(fetch.mock.calls.every(([url,options])=>!String(url).endsWith('/content')&&(!options.method||options.method==='GET'))).toBe(true);
  });
});
