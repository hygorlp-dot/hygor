// @vitest-environment node
import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({load:vi.fn(),verify:vi.fn(),refresh:vi.fn(),graph:vi.fn()}));
vi.mock('../../server/microsoft/graph.js',()=>({loadFileAccessData:mocks.load,verifyAppUser:mocks.verify,refresh:mocks.refresh,graph:mocks.graph,fileSignature:()=> 'signature',getOrCreateFolder:vi.fn(),rootItem:vi.fn(),safeName:value=>value,seal:()=>'',setCookie:vi.fn(),unseal:vi.fn(),workspace:vi.fn()}));
import handler from './onedrive.js';
const user={id:'reader',role:'engenheiro',active:true,obraId:'a'};
const payload={obras:[{id:'a',name:'Obra',oneDriveDriveId:'drive',oneDriveFolderId:'root'}],workFileCabinets:[{obraId:'a',folders:[{id:'private',parentId:'',access:{restricted:true,readers:['reader'],editors:[]}}],documents:[{id:'doc',folderId:'private',revisions:[{driveId:'drive',itemId:'item'}]}]}]};
const response=()=>({statusCode:200,headers:{},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},end(){return this;},send(body){this.body=body;return this;},setHeader(k,v){this.headers[k]=v;}});
beforeEach(()=>{vi.clearAllMocks();mocks.load.mockResolvedValue(payload);mocks.verify.mockResolvedValue({user,payload});mocks.refresh.mockResolvedValue({accessToken:'token',session:{}});mocks.graph.mockImplementation(async(token,path)=>path.endsWith('/content')?new Response('%PDF-1.4',{headers:{'content-type':'application/pdf'}}):{json:async()=>({id:'item',parentReference:{id:'root'}})});});
describe('Leitura autenticada da central',()=>{
  it('bloqueia URL assinada antiga para um documento registrado',async()=>{const res=response();await handler({method:'GET',query:{action:'file',driveId:'drive',itemId:'item',sig:'signature'}},res);expect(res.statusCode).toBe(403);expect(mocks.refresh).not.toHaveBeenCalled();expect(mocks.graph).not.toHaveBeenCalled();});
  it('rejeita usuário sem acesso à pasta antes de ler o binário',async()=>{mocks.verify.mockResolvedValue({user:{...user,id:'other'},payload});const res=response();await handler({method:'POST',query:{},body:{action:'read-file',driveId:'drive',itemId:'item'}},res);expect(res.statusCode).toBe(403);expect(mocks.graph).not.toHaveBeenCalled();});
  it('retorna o PDF com no-store para leitor autorizado, conferindo obra',async()=>{const res=response();await handler({method:'POST',query:{},body:{action:'read-file',driveId:'drive',itemId:'item'}},res);expect(res.statusCode).toBe(200);expect(res.headers['cache-control']).toBe('private, no-store');expect(res.body.toString()).toBe('%PDF-1.4');});
  it('falha fechado quando não pode carregar permissões',async()=>{mocks.load.mockRejectedValue(Object.assign(new Error('Permissões indisponíveis'),{status:503}));const res=response();await handler({method:'POST',query:{},body:{action:'read-file',driveId:'drive',itemId:'item'}},res);expect(res.statusCode).toBe(503);expect(mocks.graph).not.toHaveBeenCalled();});
});
