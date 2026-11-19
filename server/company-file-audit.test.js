import {describe,it,expect} from 'vitest';
import {auditCompanyFiles} from './company-file-audit.js';
const makePlan=()=>({sourceHash:'snapshot',projects:{a:'arcd',m:'mrc'},companies:Object.fromEntries(['arcd','mrc'].map(company=>[company,{tables:{company_app_data:[{company_id:company,key:'arced_ponto_v1',value:{obras:[{id:company==='arcd'?'a':'m',oneDriveDriveId:'shared',oneDriveFolderId:company}],employees:[]}}]}}]))});
describe('inventário de arquivos para separação',()=>{
  it('encontra pastas idênticas entre empresas, mesmo com nomes distintos',()=>{
    const plan=makePlan();plan.companies.mrc.tables.company_app_data[0].value.obras[0].oneDriveFolderId='arcd';
    const audit=auditCompanyFiles(plan,{objects:[],buckets:[]});expect(audit.issues.filter(issue=>issue.code==='CROSS_COMPANY_ROOT')).toHaveLength(2);expect(audit.activationReady).toBe(false);
  });
  it('distribui fotos pelo ID completo da obra e não pelo prefixo',()=>{
    const audit=auditCompanyFiles(makePlan(),{objects:[{id:'1',bucket:'diario-obra',name:'m/2026/file.jpg',size:3},{id:'2',bucket:'diario-obra',name:'m-extra/2026/file.jpg',size:4}],buckets:[{id:'diario-obra',public:true}]},{unlinkedCompany:'arcd'});
    expect(audit.objects[0]).toMatchObject({company:'mrc',targetName:'mrc/m/2026/file.jpg',public:true,quarantine:false});
    expect(audit.objects[1]).toMatchObject({company:'arcd',quarantine:true});
  });
  it('confere referência completa de biometria e preserva o hash esperado',()=>{
    const plan=makePlan();plan.companies.mrc.tables.ponto_biometrias=[{fotos:[{caminho:'biometria/employee/uuid.jpg',sha256:'expected'}]}];
    const audit=auditCompanyFiles(plan,{objects:[{id:'1',bucket:'ponto-obra',name:'biometria/employee/uuid.jpg'}],buckets:[]});expect(audit.objects[0]).toMatchObject({company:'mrc',expectedSha256:'expected',quarantine:false});
  });
  it('detecta binário público referenciado nas duas empresas',()=>{
    const plan=makePlan();for(const company of ['arcd','mrc'])plan.companies[company].tables.company_app_data[0].value.obras[0].capaUrl='https://storage.test/storage/v1/object/public/diario-obra/a/2026/file.jpg';
    const audit=auditCompanyFiles(plan,{objects:[{id:'1',bucket:'diario-obra',name:'a/2026/file.jpg'}],buckets:[{id:'diario-obra',public:true}]});expect(audit.issues.some(issue=>issue.code==='CROSS_COMPANY_FILE')).toBe(true);expect(audit.issues.some(issue=>issue.code==='STORAGE_REFERENCE_WRONG_COMPANY')).toBe(true);
  });
});
