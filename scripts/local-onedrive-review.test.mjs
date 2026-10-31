import {describe,it,expect,vi} from 'vitest';
import {createLocalOneDriveReview,LOCAL_ONEDRIVE_CALLBACK} from './local-onedrive-review.mjs';

const response = () => ({statusCode:200,headers:{},body:null,
  setHeader(key,value){this.headers[key]=value;},status(code){this.statusCode=code;return this;},
  json(value){this.body=value;return this;},send(value){this.body=value;return this;},end(value){this.body=value;return this;}});
const context={user:{obraId:'work'},payload:{obras:[
  {id:'work',oneDriveDriveId:'drive',oneDriveFolderId:'root'},
  {id:'other',oneDriveDriveId:'drive',oneDriveFolderId:'other-root'},
]}};
const json = value => new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
function setup({expires=3600}={}){
  let time=1_000_000;
  const fetchImpl=vi.fn(async(input,options)=>{
    const url=String(input);
    if(url.endsWith('/token'))return json({access_token:'private-token',refresh_token:'private-refresh',expires_in:expires});
    if(url.endsWith('/content'))return new Response(null,{status:302,headers:{location:'https://example.sharepoint.com/file.pdf'}});
    if(url.includes('@microsoft.graph.downloadUrl'))return json({file:{mimeType:'application/pdf'},'@microsoft.graph.downloadUrl':'https://example.sharepoint.com/file.pdf'});
    if(url==='https://example.sharepoint.com/file.pdf')return new Response('%PDF fixture',{headers:{'content-type':'application/pdf'}});
    if(url.includes('/children'))return json({value:[{id:'file',name:'NF.pdf',file:{},size:22}]});
    if(url.includes('/items/file?'))return json({id:'file',parentReference:{id:'root',driveId:'drive'}});
    if(url.includes('/items/foreign?'))return json({id:'foreign',parentReference:{id:'other-root',driveId:'drive'}});
    return json({id:'other-root',parentReference:{}});
  });
  const authenticate=vi.fn(async()=>context);
  const adapter=createLocalOneDriveReview({clientId:'public-id',clientSecret:'private-secret',authenticate,fetchImpl,now:()=>time});
  const api=async(action,body={},method='POST')=>{
    const res=response();await adapter.handleApi({method,body:{action,...body},query:method==='GET'?{action,...body}:{}},res);return res;
  };
  const start=async()=>{
    const res=response();await adapter.handleOAuth({method:'GET',headers:{'sec-fetch-site':'none'}},res,new URL('http://localhost:4192/api/local-onedrive/connect'));return res;
  };
  const finish=async(started,{cookie=true,state,code='authorization-code'}={})=>{
    const target=new URL(started.headers.location),res=response();
    const url=new URL(LOCAL_ONEDRIVE_CALLBACK);url.search=new URLSearchParams({state:state||target.searchParams.get('state'),code}).toString();
    await adapter.handleOAuth({method:'GET',headers:cookie?{cookie:started.headers['set-cookie'].split(';')[0]}:{}},res,url);return res;
  };
  return{adapter,api,start,finish,fetchImpl,authenticate,advance:ms=>{time+=ms;}};
}

describe('OneDrive local isolado e somente leitura',()=>{
  it('solicita Files.Read com PKCE, cookie HttpOnly e retorno exclusivamente local',async()=>{
    const h=setup(),start=await h.start(),target=new URL(start.headers.location);
    expect(start.statusCode).toBe(302);
    expect(target.searchParams.get('scope')).toBe('offline_access https://graph.microsoft.com/Files.Read');
    expect(target.searchParams.get('scope')).not.toContain('Write');
    expect(target.searchParams.get('redirect_uri')).toBe(LOCAL_ONEDRIVE_CALLBACK);
    expect(target.searchParams.get('code_challenge_method')).toBe('S256');
    expect(start.headers['set-cookie']).toContain('HttpOnly; SameSite=Lax');
    expect(start.headers.location).not.toContain('private-secret');
    expect((await h.finish(start)).statusCode).toBe(302);
    const body=h.fetchImpl.mock.calls[0][1].body;
    expect(body.get('code_verifier')).toBeTruthy();
    expect((await h.api('status')).body).toMatchObject({connected:true,readOnly:true,localReview:true});
  });
  it('rejeita callback sem cookie, estado inválido, expirado e reutilizado',async()=>{
    const h=setup(),start=await h.start();
    expect((await h.finish(start,{cookie:false})).statusCode).toBe(403);
    expect((await h.finish(start,{state:'forged'})).statusCode).toBe(403);
    expect(h.fetchImpl).not.toHaveBeenCalled();
    expect((await h.finish(start)).statusCode).toBe(302);
    expect((await h.finish(start)).statusCode).toBe(403);
    const expired=await h.start();h.advance(600_001);
    expect((await h.finish(expired)).statusCode).toBe(403);
  });
  it('não conecta sem credenciais e bloqueia início de login por site externo',async()=>{
    const h=setup(),res=response();
    await h.adapter.handleOAuth({method:'GET',headers:{'sec-fetch-site':'cross-site'}},res,new URL('http://localhost:4192/api/local-onedrive/connect'));
    expect(res.statusCode).toBe(403);
    const noConfig=createLocalOneDriveReview({authenticate:async()=>context});
    const missing=response();await noConfig.handleOAuth({method:'GET',headers:{}},missing,new URL('http://localhost:4192/api/local-onedrive/connect'));
    expect(missing.statusCode).toBe(503);
  });
  it('exige login do ERP para metadados e recusa todas as gravações sem consultar Graph',async()=>{
    const h=setup();h.authenticate.mockResolvedValueOnce(null);
    expect((await h.api('status')).statusCode).toBe(401);
    for(const action of ['upload','create-folder','create-workspace','sync-workspaces','upload-start','upload-chunk'])expect((await h.api(action)).statusCode).toBe(403);
    expect(h.fetchImpl).not.toHaveBeenCalled();
    expect((await h.api('status')).body.connected).toBe(false);
  });
  it('valida o escopo da obra e assina links temporários sem expor tokens',async()=>{
    const h=setup();await h.finish(await h.start());
    const allowed=await h.api('file-link',{driveId:'drive',itemId:'file'});
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body.url).toContain('expires=');
    expect(allowed.body.url).not.toMatch(/private-/);
    expect((await h.api('file-link',{driveId:'drive',itemId:'foreign'})).statusCode).toBe(403);
    expect((await h.api('file-link',{driveId:'another-drive',itemId:'file'})).statusCode).toBe(403);
    expect(h.fetchImpl.mock.calls.filter(([url])=>String(url).includes('graph.microsoft.com')).every(([,options])=>options.method==='GET')).toBe(true);
  });
  it('entrega o PDF sem bearer ao storage e recusa links adulterados e expirados',async()=>{
    const h=setup();await h.finish(await h.start());
    const link=await h.api('file-link',{driveId:'drive',itemId:'file'});
    const query=Object.fromEntries(new URL(link.body.url,'http://127.0.0.1:4192').searchParams);
    const original=await h.api('file',query,'GET');
    expect(original.body.toString()).toBe('%PDF fixture');
    expect(original.headers['content-type']).toBe('application/pdf');
    expect(original.headers['content-security-policy']).toContain('sandbox');
    const storage=h.fetchImpl.mock.calls.find(([url])=>url==='https://example.sharepoint.com/file.pdf');
    expect(storage[1].headers).toBeUndefined();
    expect((await h.api('file',{...query,itemId:'foreign'},'GET')).statusCode).toBe(403);
    h.advance(600_001);
    expect((await h.api('file',query,'GET')).statusCode).toBe(403);
  });
  it('pagina pastas sem criar estrutura e bloqueia paginação fora do Graph',async()=>{
    const h=setup();await h.finish(await h.start());
    expect((await h.api('list-folder',{driveId:'drive',parentId:'root'})).body.items[0]).toMatchObject({id:'file',name:'NF.pdf',type:'file'});
    h.fetchImpl.mockResolvedValueOnce(json({value:[], '@odata.nextLink':'https://evil.example/token'}));
    expect((await h.api('list-folder',{driveId:'drive',parentId:'root'})).statusCode).toBe(403);
    expect(h.fetchImpl.mock.calls.some(([url])=>String(url).includes('evil.example'))).toBe(false);
  });
  it('renova token apenas em memória, uma vez para leituras concorrentes',async()=>{
    const h=setup({expires:120});await h.finish(await h.start());h.advance(61_000);
    await Promise.all([h.api('file-link',{driveId:'drive',itemId:'file'}),h.api('file-link',{driveId:'drive',itemId:'file'})]);
    const requests=h.fetchImpl.mock.calls.filter(([url])=>String(url).endsWith('/token'));
    expect(requests).toHaveLength(2);
    expect(requests[1][1].body.get('grant_type')).toBe('refresh_token');
    expect(h.fetchImpl.mock.calls.every(([url])=>!String(url).includes('supabase'))).toBe(true);
  });
  it('não devolve credenciais nos erros Microsoft',async()=>{
    const h=setup();h.fetchImpl.mockResolvedValueOnce(new Response(JSON.stringify({error_description:'private-secret private-refresh'}),{status:401}));
    const res=await h.finish(await h.start());expect(res.statusCode).toBe(401);expect(res.body).not.toMatch(/private-/);
  });
  it('usa /content sem inferir ausência pela falta de facetas nos metadados',async()=>{
    const h=setup();await h.finish(await h.start());
    const link=await h.api('file-link',{driveId:'drive',itemId:'file'});
    const query=Object.fromEntries(new URL(link.body.url,'http://127.0.0.1:4192').searchParams);
    expect((await h.api('file',query,'GET')).statusCode).toBe(200);
    const content=h.fetchImpl.mock.calls.find(([url])=>String(url).endsWith('/content'));
    expect(content[1].redirect).toBe('manual');
    expect(h.fetchImpl.mock.calls.some(([url])=>String(url).includes('@microsoft.graph.downloadUrl'))).toBe(false);
  });
  it('recusa redirecionamento de conteúdo para host externo sem encaminhar bearer',async()=>{
    const h=setup();await h.finish(await h.start());
    const link=await h.api('file-link',{driveId:'drive',itemId:'file'});
    const query=Object.fromEntries(new URL(link.body.url,'http://127.0.0.1:4192').searchParams);
    h.fetchImpl.mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'https://evil.example/file'}}));
    expect((await h.api('file',query,'GET')).statusCode).toBe(502);
    expect(h.fetchImpl.mock.calls.some(([url])=>String(url).includes('evil.example'))).toBe(false);
  });
  it('aceita armazenamento pessoal Microsoft e valida cada redirecionamento sem bearer',async()=>{
    const h=setup();await h.finish(await h.start());
    const link=await h.api('file-link',{driveId:'drive',itemId:'file'});
    const query=Object.fromEntries(new URL(link.body.url,'http://127.0.0.1:4192').searchParams);
    h.fetchImpl.mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'https://download.livefilestore.com/file'}}))
      .mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'https://download.my.microsoftpersonalcontent.com/file'}}))
      .mockResolvedValueOnce(new Response('JPEG',{headers:{'content-type':'image/jpeg'}}));
    const result=await h.api('file',query,'GET');expect(result.statusCode).toBe(200);expect(result.body.toString()).toBe('JPEG');
    for(const [url,options]of h.fetchImpl.mock.calls.filter(([url])=>String(url).includes('livefilestore')||String(url).includes('microsoftpersonalcontent'))){
      expect(url).toMatch(/^https:/);expect(options.headers).toBeUndefined();expect(options.redirect).toBe('manual');
    }
  });
});
