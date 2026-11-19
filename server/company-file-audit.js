import {createHash} from 'node:crypto';
import {decodeAppData} from './data-codec.js';
import {companySourceView} from './company-source-view.js';

const digest=value=>createHash('sha256').update(value).digest('hex');
const companies=['arcd','mrc'];
const safePath=value=>typeof value==='string'&&!value.split('/').some(part=>!part||part==='.'||part==='..'||/[\\\x00-\x1f]/.test(part));

// References are compared by provider identity, never by filename or label.
export function auditCompanyFiles(plan,storage,{environment={},unlinkedCompany}={}){
  const references=[],roots=[],issues=[],integrations=[];
  for(const company of companies){
    const tables=plan.companies[company].tables,{data}=companySourceView(tables,company);
    for(const work of data.obras||[])if(work.oneDriveDriveId&&work.oneDriveFolderId)roots.push({company,projectId:String(work.id),driveId:String(work.oneDriveDriveId),folderId:String(work.oneDriveFolderId)});
    const visit=(node,path)=>{
      if(!node||typeof node!=='object')return;
      if(node.driveId&&node.itemId)references.push({company,path,provider:'onedrive',identity:`${node.driveId}/${node.itemId}`,driveId:String(node.driveId),itemId:String(node.itemId)});
      for(const [key,value]of Object.entries(node)){
        const location=`${path}/${key}`;
        if(typeof value==='string'&&/^https?:\/\//i.test(value)){
          try{
            const url=new URL(value),storageMatch=/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/.exec(url.pathname);
            if(storageMatch)references.push({company,path:location,provider:'storage',host:url.host,bucket:decodeURIComponent(storageMatch[1]),name:decodeURIComponent(storageMatch[2]),identity:`${url.host}/${decodeURIComponent(storageMatch[1])}/${decodeURIComponent(storageMatch[2])}`,publicUrl:url.pathname.includes('/public/')});
            else if(/(?:1drv\.ms|(?:^|\.)onedrive\.live\.com|(?:^|\.)sharepoint\.com)$/i.test(url.hostname))references.push({company,path:location,provider:'onedrive-link',identity:digest(value),url:value});
          }catch{issues.push({code:'INVALID_FILE_URL',company,path:location});}
        }else if(typeof value==='string'&&value.startsWith('/api/microsoft/onedrive?')){
          const url=new URL(value,'https://local.invalid'),driveId=url.searchParams.get('driveId'),itemId=url.searchParams.get('itemId');
          if(driveId&&itemId)references.push({company,path:location,provider:'onedrive',identity:`${driveId}/${itemId}`,driveId,itemId,legacySignature:!url.searchParams.has('companyId')});
        }
        if(value&&typeof value==='object')visit(value,location);
      }
    };
    // Current domain merge plus separate documents/chat. Historical backups
    // are preserved in the source archive and do not grant current access.
    visit(data,'/current');
    for(const row of tables.company_app_data||[])if(row.key.startsWith('rh_doc_')||row.key.startsWith('arced_chat_msg__'))visit(decodeAppData(row.value),`/company_app_data/${row.key}`);
    const auth=(tables.company_app_data||[]).some(row=>row.key==='onedrive_auth_v1');
    integrations.push({company,kind:'onedrive',storedSession:auth,rootConfigured:!!environment[`ONEDRIVE_ROOT_FOLDER_URL_${company.toUpperCase()}`],oauthConfigured:['MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET','MICROSOFT_REDIRECT_URI'].every(key=>!!environment[key]),state:'disabled-pending-cloud-verification'});
    integrations.push({company,kind:'backup',companyBound:true,keyConfigured:!!environment.BACKUP_ENCRYPTION_KEY,state:'local-tests-only'});
    integrations.push({company,kind:'portal-supplier-links',companyBound:true,state:'local-tests-only'});
    integrations.push({company,kind:'smtp-whatsapp',messagesSent:0,state:'not-connected-by-this-review'});
    if(auth&&company==='mrc')issues.push({code:'MRC_SESSION_REQUIRES_EXPLICIT_RECONNECTION',company});
  }
  for(const root of roots)if(roots.some(other=>other.company!==root.company&&other.driveId===root.driveId&&other.folderId===root.folderId))issues.push({code:'CROSS_COMPANY_ROOT',company:root.company,projectId:root.projectId});
  const identities=new Map();
  for(const ref of references){const key=`${ref.provider}:${ref.identity}`,previous=identities.get(key);if(previous&&previous.company!==ref.company)issues.push({code:'CROSS_COMPANY_FILE',company:ref.company,path:ref.path,otherCompany:previous.company});else identities.set(key,ref);}
  const objects=(storage.objects||[]).map(object=>{
    const parts=object.name.split('/');let company=null,projectId=null;
    if(['arcd','mrc'].includes(parts[0]))company=parts[0];
    else if(object.bucket==='diario-obra'&&plan.projects[parts[0]]){projectId=parts[0];company=plan.projects[projectId];}
    else if(object.bucket==='ponto-obra'&&parts[0]==='marcacoes'&&plan.projects[parts[1]]){projectId=parts[1];company=plan.projects[projectId];}
    else if(object.bucket==='ponto-obra'&&parts[0]==='biometria'){
      // Biometric paths use exact employee IDs encoded by the existing app.
      const owners=companies.filter(c=>(plan.companies[c].tables.ponto_biometrias||[]).some(row=>(row.fotos||[]).some(photo=>photo.caminho===object.name)));
      if(owners.length===1)company=owners[0];
    }else if(object.bucket==='patrimonio-empresa'&&parts[0]==='patrimonio')company='arcd';
    // Exact captured row reference is stronger than a path convention.
    if(!company){
      const owners=companies.filter(c=>Object.entries(plan.companies[c].tables).some(([table,rows])=>table!=='company_app_data'&&rows.some(row=>Object.entries(row).some(([key,value])=>/foto|path|caminho/i.test(key)&&value===object.name))));
      if(owners.length===1)company=owners[0];
    }
    const refs=references.filter(ref=>ref.provider==='storage'&&ref.bucket===object.bucket&&ref.name===object.name);
    if(!company&&new Set(refs.map(ref=>ref.company)).size===1)company=refs[0].company;
    const quarantine=!company;
    // Unreferenced legacy bytes are preserved in the authorized ARCD archive,
    // never linked to an employee/project by a name or filename similarity.
    if(!company&&unlinkedCompany==='arcd')company='arcd';
    if(!safePath(object.name))issues.push({code:'STORAGE_PATH_INVALID',objectId:object.id});
    if(quarantine)issues.push({code:company?'UNREFERENCED_STORAGE_ARCHIVED_ARCD':'STORAGE_OWNER_UNRESOLVED',objectId:object.id});
    if(company&&refs.some(ref=>ref.company!==company))issues.push({code:'STORAGE_REFERENCE_WRONG_COMPANY',objectId:object.id});
    const bucket=storage.buckets.find(item=>item.id===object.bucket);
    const biometric=companies.flatMap(c=>plan.companies[c].tables.ponto_biometrias||[]).flatMap(row=>row.fotos||[]).find(photo=>photo.caminho===object.name);
    const event=object.bucket==='ponto-obra'&&parts[0]==='marcacoes'?companies.flatMap(c=>plan.companies[c].tables.ponto_eventos||[]).find(row=>`${row.event_id}.jpg`===parts.at(-1)):null;
    const originHost=environment.SUPABASE_URL?new URL(environment.SUPABASE_URL).host:null;
    return {...object,company,projectId,quarantine,originHost,expectedSha256:biometric?.sha256||event?.foto_sha256||null,public:bucket?.public===true,targetBucket:object.bucket==='diario-obra'?'company-files-private':object.bucket,targetName:company?(parts[0]===company?object.name:`${company}/${object.name}`):null,referenceCount:refs.length};
  });
  for(const ref of references.filter(ref=>ref.provider==='storage')){
    if(environment.SUPABASE_URL&&ref.host!==new URL(environment.SUPABASE_URL).host)issues.push({code:'STORAGE_REFERENCE_FOREIGN_HOST',company:ref.company,path:ref.path});
    if(!objects.some(object=>object.bucket===ref.bucket&&object.name===ref.name))issues.push({code:'STORAGE_REFERENCE_NOT_IN_INVENTORY',company:ref.company,path:ref.path});
  }
  return {version:1,sourceHash:plan.sourceHash,capturedAt:storage.capturedAt,localOnly:true,remoteWrites:0,cloudVerified:false,activationReady:false,objects,references,roots,integrations,issues,
    summary:{objects:objects.length,bytes:objects.reduce((n,o)=>n+Number(o.size||0),0),publicObjects:objects.filter(o=>o.public).length,expectedHashes:objects.filter(o=>o.expectedSha256).length,archivedUnreferencedObjects:objects.filter(o=>o.quarantine).length,unresolvedObjects:objects.filter(o=>!o.company).length,referenceCounts:Object.fromEntries(companies.map(company=>[company,references.filter(ref=>ref.company===company).length])),crossCompanyIssues:issues.filter(issue=>issue.code.startsWith('CROSS_COMPANY')||issue.code==='STORAGE_REFERENCE_WRONG_COMPANY').length},
    pending:['Preparar buckets privados e copiar objetos para os destinos por empresa após autorização de implantação.','Conferir permissões e ancestralidade das pastas OneDrive com conexão autorizada de cada empresa.','Reconectar sessões Microsoft vinculadas à empresa, sem reaproveitar credenciais legadas na MRC.','Atualizar referências e renovar links assinados no corte; preservar os originais até a conferência.']};
}
