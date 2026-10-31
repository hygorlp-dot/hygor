import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canUploadToDestination } from './upload-policy.js';
import handler from '../api/microsoft/onedrive.js';
import { verifyAppUser, refresh, graph, getOrCreateFolder } from './microsoft/graph.js';

vi.mock('./microsoft/graph.js',()=>({
  verifyAppUser:vi.fn(),refresh:vi.fn(),graph:vi.fn(),getOrCreateFolder:vi.fn(),
  fileSignature:vi.fn(()=> 'signature'),rootItem:vi.fn(),safeName:value=>value,
  seal:vi.fn(()=> 'sealed'),setCookie:vi.fn(),unseal:vi.fn(),workspace:vi.fn(),
}));
const res = () => ({statusCode:200,status:vi.fn(function(code){this.statusCode=code;return this;}),json:vi.fn(function(body){this.body=body;return this;}),end:vi.fn()});
const work={id:'w',name:'Obra',oneDriveDriveId:'drive',oneDriveFolderId:'root'};
beforeEach(()=>{
  vi.clearAllMocks();
  verifyAppUser.mockResolvedValue({user:{id:'reader',role:'visualizador',active:true},payload:{obras:[work]}});
  refresh.mockResolvedValue({accessToken:'ms-token',session:{}});
  getOrCreateFolder.mockResolvedValue({id:'new-folder'});
  graph.mockResolvedValue({json:async()=>({id:'photo'})});
});
describe('documentos da obra respeitam perfil somente leitura',()=>{
  it('nega upload operacional para visualizador ou papel desconhecido',()=>{
    for(const role of ['visualizador','visitante'])expect(canUploadToDestination({id:'u',role},{obraId:'w'})).toBe(false);
  });
  it.each(['upload','upload-start','upload-chunk','create-folder','create-workspace'])('nega %s no OneDrive antes de acessar credenciais Microsoft',async action=>{
    const response=res();
    await handler({method:'POST',query:{},body:{action,userId:'reader',obraId:'w',category:'licenciamento',driveId:'drive',parentId:'root',name:'pasta',dataUrl:'data:image/png;base64,aGVsbG8=',fileName:'foto.png',fileSize:10}},response);
    expect(response.statusCode).toBe(403);
    expect(refresh).not.toHaveBeenCalled();
    expect(graph).not.toHaveBeenCalled();
    expect(getOrCreateFolder).not.toHaveBeenCalled();
  });
  it('preserva upload de trabalho para perfis operacionais conhecidos e escopo de obra',()=>{
    for(const role of ['admin','engenheiro','engenheiro_auditor','financeiro','compras','rh','comercial']) {
      expect(canUploadToDestination({id:'u',role,obraId:'w'},{obraId:'w'})).toBe(true);
      expect(canUploadToDestination({id:'u',role,obraId:'w'},{obraId:'other'})).toBe(false);
    }
    expect(canUploadToDestination({id:'u',role:'visualizador'},{folder:'chat'})).toBe(true);
  });
  it('um nome inválido não envia o arquivo para outra obra no mesmo drive',async()=>{
    verifyAppUser.mockResolvedValue({user:{id:'writer',role:'engenheiro',obraId:'w'},payload:{obras:[work]}});
    const response=res();
    await handler({method:'POST',query:{},body:{action:'upload',obraName:'Obra desatualizada',driveId:'drive',dataUrl:'data:image/png;base64,aGVsbG8='}},response);
    expect(response.statusCode).toBe(403);
    expect(graph).not.toHaveBeenCalled();
    expect(getOrCreateFolder).not.toHaveBeenCalled();
  });
});
