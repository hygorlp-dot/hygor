// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {prepareCompanyFileSeparation} from './company-file-preparation.js';

export const fixture=()=>{
  const work=(id,name)=>({id,name,oneDriveDriveId:'drive',oneDriveFolderId:'shared',oneDriveFolders:{'03 - Documentos':'docs','03 - Documentos/Licenciamento':'licenses'}});
  const plan={sourceHash:'source',projects:{i:'mrc',base:'arcd',photo:'arcd'},companies:{
    mrc:{tables:{company_app_data:[{company_id:'mrc',key:'arced_ponto_v1',value:{obras:[{...work('i','I-8'),documentosOneDrive:[{url:'/api/microsoft/onedrive?driveId=drive&itemId=doc'}]}]}}],core_projects:[{id:'i',company_id:'mrc',payload:{documentosOneDrive:[{url:'/api/microsoft/onedrive?driveId=drive&itemId=doc'}]}}]}},
    arcd:{tables:{company_app_data:[{company_id:'arcd',key:'arced_ponto_v1',updated_at:'revision',value:{obras:[work('base','BASE DE DADOS'),{id:'photo',name:'Obra das fotos'}],rdos:[{id:'rdo',obraId:'photo',photos:[{url:'https://storage.test/storage/v1/object/public/diario-obra/photo/2026/a.jpg'}]}]}}]}},
  }};
  const audit={sourceHash:'source',references:[{company:'arcd',provider:'storage',host:'storage.test',bucket:'diario-obra',name:'photo/2026/a.jpg',path:'/current/rdos/0/photos/0/url'}],objects:['a','b'].map(id=>({id,company:'arcd',projectId:'photo',bucket:'diario-obra',name:`photo/2026/${id}.jpg`,public:true,originHost:'storage.test',size:4,mime:'image/jpeg',localCopy:{path:`/private/${id}`,sha256:'hash',bytes:4}}))};
  return {plan,audit,targets:[{company:'mrc',projectId:'i'},{company:'arcd',projectId:'base'}]};
};
describe('preparação offline de pastas e fotos',()=>{
  it('mantém os dados e fatos financeiros intactos e separa os destinos por empresa',()=>{
    const input=fixture(),original=structuredClone(input),result=prepareCompanyFileSeparation(input.plan,input.audit,input.targets);
    expect(input).toEqual(original);expect(result.summary).toMatchObject({workspaces:2,categories:4,identifiedDocuments:1,blockedDocuments:0,photos:2,activePhotoReferences:1});
    expect(result.workspaces.map(ws=>ws.destination.companyRootRef)).toEqual(['company-root:mrc','company-root:arcd']);
    expect(result.workspaces.every(ws=>ws.destination.remoteFolderId===null)).toBe(true);
    expect(result).toMatchObject({networkAllowed:false,remoteWrites:0,activationReady:false,dre:{changesFinancialFacts:false}});
  });
  it('reutiliza o ID exato do cadastro relacional em vez de gerar falsa ambiguidade',()=>{
    const {plan,audit,targets}=fixture(),result=prepareCompanyFileSeparation(plan,audit,targets),doc=result.workspaces[0].documents[0];
    expect(doc.state).toBe('copy-candidate-pending-cloud-inspection');expect(doc.sourcePaths).toHaveLength(2);
  });
  it('bloqueia um documento também referenciado por outra empresa',()=>{
    const {plan,audit,targets}=fixture();plan.companies.arcd.tables.company_app_data[0].value.obras[0].documentosOneDrive=[{driveId:'drive',itemId:'doc'}];
    const result=prepareCompanyFileSeparation(plan,audit,targets);expect(result.summary.blockedDocuments).toBe(2);expect(result.workspaces[0].documents[0].state).toBe('blocked-shared-or-ambiguous');
  });
  it('prepara as duas fotos na ARCD sem ligar a segunda a um RDO nem às obras das pastas',()=>{
    const {plan,audit,targets}=fixture(),result=prepareCompanyFileSeparation(plan,audit,targets);
    expect(result.photos.map(photo=>photo.destination.name)).toEqual(['arcd/photo/2026/a.jpg','arcd/photo/2026/b.jpg']);
    expect(result.photos.every(photo=>photo.attachToNewRecord===false&&photo.destination.public===false)).toBe(true);
    expect(result.photos[0].persistedReferences).toMatchObject([{rowKey:'arced_ponto_v1',rowUpdatedAt:'revision',pointer:'/rdos/0/photos/0/url'}]);
    expect(result.photos[1].persistedReferences).toEqual([]);
  });
  it('recusa origem divergente, empresa errada e nomes capazes de escapar da pasta local',()=>{
    const a=fixture();a.audit.sourceHash='other';expect(()=>prepareCompanyFileSeparation(a.plan,a.audit,a.targets)).toThrow('outra captura');
    const b=fixture();b.targets[0].company='arcd';expect(()=>prepareCompanyFileSeparation(b.plan,b.audit,b.targets)).toThrow('incompatível');
    const c=fixture();c.plan.companies.mrc.tables.company_app_data[0].value.obras[0].oneDriveFolders['../outside']='bad';expect(()=>prepareCompanyFileSeparation(c.plan,c.audit,c.targets)).toThrow('Categoria');
  });
  it('não inventa pasta compartilhada, obra ou propriedade da foto',()=>{
    const a=fixture();a.plan.companies.arcd.tables.company_app_data[0].value.obras[0].oneDriveFolderId='different';expect(()=>prepareCompanyFileSeparation(a.plan,a.audit,a.targets)).toThrow('conflito');
    const b=fixture();b.audit.objects[0].company='mrc';expect(()=>prepareCompanyFileSeparation(b.plan,b.audit,b.targets)).toThrow('proprietário');
    const c=fixture();c.targets[1].projectId='missing';expect(()=>prepareCompanyFileSeparation(c.plan,c.audit,c.targets)).toThrow('incompatível');
  });
});
