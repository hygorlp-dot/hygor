// Temporary read-only browser verification. Uses the ERP's ordinary API helpers;
// never reads credentials, cookies or browser storage. Only aggregate results
// are sent to the loopback test collector, never records, names or file bytes.
import {temSessao,statusOneDrive,loadDataWithMeta,listarPastaOneDrive,obterLinkArquivoOneDrive} from '../src/api.js';
import {documentRegister} from '../src/domains/financeiro/document-register.js';

if(import.meta.env.DEV && location.origin==='http://127.0.0.1:4192'){
 const report=async result=>fetch('http://127.0.0.1:4194/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)}).catch(()=>{});
 (async()=>{
  for(let i=0;i<90&&!temSessao();i++)await new Promise(resolve=>setTimeout(resolve,1000));
  if(!temSessao())return report({phase:'erp-login-required'});
  const status=await statusOneDrive();
  if(!status.ok||!status.connected)return report({phase:'connection',httpStatus:status.status||0,connected:!!status.connected});
  await report({phase:'connection',connected:true});
  const {data}=await loadDataWithMeta();
  if(!data)return report({phase:'data-unavailable'});
  const works=(data.obras||[]).filter(work=>work.oneDriveDriveId&&work.oneDriveFolderId);
  const register=documentRegister(data,{obraId:'all',competence:''});
  const summary={phase:'documents',connected:true,worksWithFolders:works.length,foldersRead:0,folderErrors:0,filesFound:0,originalsRead:0,originalErrors:0,invoices:(data.notasFiscais||[]).length,records:register.length,linkedDocuments:0,protectedReferences:0,linkedOriginalsRead:0,linkedOriginalErrors:0};
  for(const row of register){for(const doc of row.docs){
   if(!doc.url&&!doc.webUrl)continue;
   summary.linkedDocuments++;
   const url=new URL(doc.url||doc.webUrl,location.origin);
   if(url.pathname!=='/api/microsoft/onedrive'||url.searchParams.get('action')!=='file')continue;
   const driveId=url.searchParams.get('driveId'),itemId=url.searchParams.get('itemId');
   if(!driveId||!itemId)continue;summary.protectedReferences++;
   const link=await obterLinkArquivoOneDrive({driveId,itemId});
   if(!link.ok){summary.linkedOriginalErrors++;summary.lastOriginalHttpStatus=link.status||0;continue;}
   const response=await fetch(link.url);if(response.ok){await response.arrayBuffer();summary.linkedOriginalsRead++;}else{summary.linkedOriginalErrors++;summary.lastOriginalHttpStatus=response.status;}
  }}
  // Test existing financial folders only; never sync or create workspace paths.
  for(const work of works.slice(0,6)){
   const parentId=work.oneDriveFolders?.['08 - Financeiro e Fiscal']||work.oneDriveFolderId;
   const listing=await listarPastaOneDrive({driveId:work.oneDriveDriveId,parentId});
   if(!listing.ok){summary.folderErrors++;summary.lastFolderHttpStatus=listing.status||0;continue;}
   summary.foldersRead++;
   const files=(listing.items||[]).filter(item=>item.type==='file');summary.filesFound+=files.length;
   const original=files.find(item=>/\.(pdf|png|jpe?g|xml)$/i.test(item.name||''));
   if(original&&summary.originalsRead<2){
    const link=await obterLinkArquivoOneDrive({driveId:work.oneDriveDriveId,itemId:original.id});
    if(link.ok){const response=await fetch(link.url);if(response.ok){await response.arrayBuffer();summary.originalsRead++;}else{summary.originalErrors++;summary.lastOriginalHttpStatus=response.status;}}
    else{summary.originalErrors++;summary.lastOriginalHttpStatus=link.status||0;}
   }
  }
  await report(summary);
 })().catch(()=>report({phase:'probe-failed'}));
}
