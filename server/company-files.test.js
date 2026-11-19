// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {resolveCompanyFile,resolvePublishedCompanyFile} from './company-files.js';
import {companyFileReference,parseCompanyFileReference} from '../src/domains/arquivos/company-file-reference.js';
const path='arcd/work-a/2026/35136ece-8161-4cb3-89a2-b9d6a4ad470c.jpg';
const reference=companyFileReference(path);
const fixture=()=>{
 const createSignedUrl=vi.fn(async()=>({data:{signedUrl:'https://storage.test/signed'},error:null}));
 const from=vi.fn(()=>({createSignedUrl}));
 return {input:{reference,companyId:'arcd',user:{id:'eng',role:'engenheiro',active:true,obraId:'work-a'},works:[{id:'work-a'}],storage:{from}},from,createSignedUrl};
};
it('preserva referência estável e reconhece somente o namespace privado válido',()=>{
 expect(parseCompanyFileReference(reference)).toMatchObject({companyId:'arcd',projectId:'work-a',name:path,bucket:'company-files-private'});
 for(const value of [reference+'?token=secret',reference+'#x',reference.replace('arcd/','foreign/'),reference.replace('work-a/','../'),reference.replace('work-a/','work%2fa/'),reference.replace('arcd/','user@arcd/'),'https://storage.test/arcd/file.jpg'])expect(parseCompanyFileReference(value)).toBeNull();
});
it('assina somente após conferir empresa, obra e acesso ao diário',async()=>{
 const f=fixture(),r=await resolveCompanyFile(f.input);expect(r.status).toBe(200);
 expect(f.from).toHaveBeenCalledWith('company-files-private');expect(f.createSignedUrl).toHaveBeenCalledWith(path,300);
});
it('nega outra empresa, obra, perfil inativo e aba sem permissão antes de falar com Storage',async()=>{
 for(const patch of [{companyId:'mrc'},{works:[]},{user:{role:'engenheiro',obraId:'other'}},{user:{role:'engenheiro',active:false}},{user:{role:'rh',accessTabs:['equipe']}}]){
  const f=fixture();Object.assign(f.input,patch);expect((await resolveCompanyFile(f.input)).status).toBe(403);expect(f.from).not.toHaveBeenCalled();
 }
});
it('recusa referência inválida e não transforma erro de Storage em URL pública',async()=>{
 const f=fixture();expect((await resolveCompanyFile({...f.input,reference:'company-file:bad'})).status).toBe(400);expect(f.from).not.toHaveBeenCalled();
 f.createSignedUrl.mockResolvedValue({error:{message:'not found'}});expect((await resolveCompanyFile(f.input)).status).toBe(404);
});
it('anexo do chat é restrito à empresa e dispensa uma obra fictícia',async()=>{
 const f=fixture();f.input.reference=companyFileReference(path.replace('work-a/','chat/'));f.input.works=[];
 expect((await resolveCompanyFile(f.input)).status).toBe(200);
});
it('portal só assina a foto publicada da empresa e obra já autorizadas',async()=>{
 const f=fixture();expect((await resolvePublishedCompanyFile({reference,companyId:'arcd',projectId:'work-a',storage:f.input.storage})).status).toBe(200);
 for(const patch of [{companyId:'mrc'},{projectId:'other'},{reference:companyFileReference(path.replace('work-a/','chat/'))}]){
  f.from.mockClear();expect((await resolvePublishedCompanyFile({reference,companyId:'arcd',projectId:'work-a',storage:f.input.storage,...patch})).status).toBe(403);expect(f.from).not.toHaveBeenCalled();
 }
});
