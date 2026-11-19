// @vitest-environment node
import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({load:vi.fn(),verify:vi.fn(),refresh:vi.fn(),graph:vi.fn(),isolated:false}));
vi.mock('../../server/company-context.js',()=>({currentCompany:()=> 'arcd',isolationEnabled:()=>mocks.isolated,withCompanyContext:handler=>handler}));
vi.mock('../../server/microsoft/graph.js',()=>({loadFileAccessData:mocks.load,verifyAppUser:mocks.verify,refresh:mocks.refresh,graph:mocks.graph,fileSignature:()=> 'signature',getOrCreateFolder:vi.fn(),rootItem:vi.fn(),safeName:value=>value,seal:()=>'',setCookie:vi.fn(),unseal:vi.fn(),workspace:vi.fn()}));
import handler from './onedrive.js';
const user={id:'reader',role:'engenheiro',active:true,obraId:'a'};
const payload={obras:[{id:'a',name:'Obra',oneDriveDriveId:'drive',oneDriveFolderId:'root'}],workFileCabinets:[{obraId:'a',folders:[{id:'private',parentId:'',access:{restricted:true,readers:['reader'],editors:[]}}],documents:[{id:'doc',folderId:'private',revisions:[{driveId:'drive',itemId:'item'}]}]}]};
const response=()=>({statusCode:200,headers:{},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},end(){return this;},send(body){this.body=body;return this;},setHeader(k,v){this.headers[k]=v;}});
beforeEach(()=>{vi.clearAllMocks();mocks.isolated=false;mocks.load.mockResolvedValue(payload);mocks.verify.mockResolvedValue({user,payload});mocks.refresh.mockResolvedValue({accessToken:'token',session:{}});mocks.graph.mockImplementation(async(token,path)=>path.endsWith('/content')?new Response('%PDF-1.4',{headers:{'content-type':'application/pdf'}}):{json:async()=>({id:'item',parentReference:{id:'root'}})});});
describe('Leitura autenticada da central',()=>{
  it('recusa link GET mesmo com assinatura conhecida quando o isolamento está ativo',async()=>{
    mocks.isolated=true;const res=response();
    await handler({method:'GET',query:{action:'file',driveId:'drive',itemId:'unregistered',sig:'signature'}},res);
    expect(res.statusCode).toBe(403);expect(mocks.refresh).not.toHaveBeenCalled();expect(mocks.graph).not.toHaveBeenCalled();
  });
  it('bloqueia URL assinada antiga para um documento registrado',async()=>{const res=response();await handler({method:'GET',query:{action:'file',driveId:'drive',itemId:'item',sig:'signature'}},res);expect(res.statusCode).toBe(403);expect(mocks.refresh).not.toHaveBeenCalled();expect(mocks.graph).not.toHaveBeenCalled();});
  it('rejeita usuário sem acesso à pasta antes de ler o binário',async()=>{mocks.verify.mockResolvedValue({user:{...user,id:'other'},payload});const res=response();await handler({method:'POST',query:{},body:{action:'read-file',driveId:'drive',itemId:'item'}},res);expect(res.statusCode).toBe(403);expect(mocks.graph).not.toHaveBeenCalled();});
  it('retorna o PDF com no-store para leitor autorizado, conferindo obra',async()=>{const res=response();await handler({method:'POST',query:{},body:{action:'read-file',driveId:'drive',itemId:'item'}},res);expect(res.statusCode).toBe(200);expect(res.headers['cache-control']).toBe('private, no-store');expect(res.body.toString()).toBe('%PDF-1.4');});
  it('falha fechado quando não pode carregar permissões',async()=>{mocks.load.mockRejectedValue(Object.assign(new Error('Permissões indisponíveis'),{status:503}));const res=response();await handler({method:'POST',query:{},body:{action:'read-file',driveId:'drive',itemId:'item'}},res);expect(res.statusCode).toBe(503);expect(mocks.graph).not.toHaveBeenCalled();});
  it('permite somente leitura ao administrador de uma raiz histórica conferida',async()=>{
    mocks.isolated=true;mocks.verify.mockResolvedValue({user:{id:'admin',role:'admin'},payload});
    mocks.load.mockResolvedValue({...payload,nativeFileWorkspaces:[{id:'historical',oneDriveDriveId:'drive',oneDriveFolderId:'historical-root'}]});
    mocks.graph.mockImplementation(async(token,path)=>({json:async()=>path.includes('@microsoft.graph.downloadUrl')?{id:'historical-file','@microsoft.graph.downloadUrl':'https://my.microsoftpersonalcontent.com/private-file'}:{id:'historical-file',parentReference:{id:'historical-root'}}}));
    const res=response();await handler({method:'POST',query:{},body:{action:'read-file',driveId:'drive',itemId:'historical-file'}},res);
    expect(res.statusCode).toBe(303);expect(res.headers.Location).toBe('https://my.microsoftpersonalcontent.com/private-file');expect(mocks.load).toHaveBeenCalledWith({includeNativeWorkspaces:true});
    expect(mocks.graph.mock.calls.some(([,path])=>path.endsWith('/content'))).toBe(false);
  });
  it('não amplia o escopo de obra do engenheiro por uma raiz histórica',async()=>{
    mocks.isolated=true;mocks.load.mockResolvedValue({...payload,nativeFileWorkspaces:[{id:'historical',oneDriveDriveId:'drive',oneDriveFolderId:'historical-root'}]});
    mocks.graph.mockImplementation(async()=>({json:async()=>({id:'historical-file',parentReference:{id:null}})}));
    const res=response();await handler({method:'POST',query:{},body:{action:'read-file',driveId:'drive',itemId:'historical-file'}},res);
    expect(res.statusCode).toBe(403);expect(mocks.load).toHaveBeenCalledWith({includeNativeWorkspaces:false});
  });
  it('recusa redirecionamento privado para um host fora da Microsoft',async()=>{
    mocks.isolated=true;mocks.graph.mockImplementation(async(token,path)=>({json:async()=>path.includes('@microsoft.graph.downloadUrl')?{id:'item','@microsoft.graph.downloadUrl':'https://evil.test/file'}:{id:'item',parentReference:{id:'root'}}}));
    const res=response();await handler({method:'POST',query:{},body:{action:'read-file',driveId:'drive',itemId:'item'}},res);
    expect(res.statusCode).toBe(503);expect(res.headers.Location).toBeUndefined();
  });
});
