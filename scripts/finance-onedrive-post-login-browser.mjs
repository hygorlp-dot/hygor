import React from 'react';
import {createRoot} from 'react-dom/client';
import {temSessao,statusOneDrive,loadDataWithMeta,obterLinkArquivoOneDrive} from '../src/api.js';
import {documentRegister} from '../src/domains/financeiro/document-register.js';
import {protectedDocumentReference} from '../src/domains/financeiro/document-links.js';
import {FinancialEntryDetails} from '../src/features/financeiro/DreMemorial.jsx';
import DocumentCenter from '../src/features/financeiro/DocumentCenter.jsx';

// Temporary verification with the user's ordinary ERP session. Render actual
// components in a detached tree; leave the user's page, filters and data alone.
if(import.meta.env.DEV&&location.origin==='http://127.0.0.1:4192'){
 const report=async result=>fetch('http://127.0.0.1:4194/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)}).catch(()=>{});
 (async()=>{
  await report({phase:'verification-started'});
  let connected=false;
  for(let attempt=0;attempt<180;attempt++){
   if(temSessao()){
    const status=await statusOneDrive();if(status.ok&&!status.localReview)return;
    if(status.connected){connected=true;break;}
   }
   if(attempt===0)await report({phase:temSessao()?'waiting-authorization':'waiting-erp-session'});
   await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if(!connected)return report({phase:'authorization-required'});
  await report({phase:'reading-originals',connected:true});
  const {data}=await loadDataWithMeta();if(!data)return report({phase:'data-unavailable'});
  const expectedIds=new Set(['ezcd9jb6no0g','86n99g2c3cg1']);
  const rows=documentRegister(data,{obraId:'all',competence:''}).filter(row=>row.type==='pedido'&&expectedIds.has(row.record.id));
  const result={phase:'reader-activated',connected:true,targets:rows.length,originalsRead:0,imagesDecoded:0,memorialReferencesVerified:0,centralReferencesVerified:0,originalErrors:0};
  for(const row of rows){
   const original=row.docs.find(doc=>protectedDocumentReference(doc.url||doc.webUrl));
   if(!original){result.originalErrors++;continue;}
   const reference=protectedDocumentReference(original.url||original.webUrl);
   // Check both real UI surfaces render this exact original reference.
   const host=document.createElement('div'),root=createRoot(host);
   const renderedReference=()=>[...host.querySelectorAll('a')].some(anchor=>{
    const value=protectedDocumentReference(anchor.getAttribute('href'));
    return value?.driveId===reference.driveId&&value?.itemId===reference.itemId;
   });
   try{
    root.render(React.createElement(FinancialEntryDetails,{item:row.entry}));
    await new Promise(resolve=>setTimeout(resolve,120));
    if(renderedReference())result.memorialReferencesVerified++;
    root.render(React.createElement(DocumentCenter,{data,obraId:row.entry.obraId,competence:'',view:{query:'',filter:'all',selected:row.id},onViewChange:()=>{},onOpen:()=>{},onReview:()=>{},onReceive:()=>{}}));
    await new Promise(resolve=>setTimeout(resolve,120));
    if(renderedReference())result.centralReferencesVerified++;
   }finally{root.unmount();}
   const link=await obterLinkArquivoOneDrive(reference);
   if(!link.ok){result.originalErrors++;result.lastOriginalHttpStatus=link.status||0;continue;}
   const response=await fetch(link.url);
   if(!response.ok){result.originalErrors++;result.lastOriginalHttpStatus=response.status;
    const failure=await response.json().catch(()=>({}));
    const stages={'Endereço do documento não reconhecido.':'reader-host-rejected','Não foi possível consultar o documento no OneDrive.':'reader-graph-failed','Não foi possível abrir o documento original.':'reader-storage-failed','O OneDrive não informou o endereço de download.':'reader-redirect-missing','Falha na consulta local ao OneDrive.':'reader-network-failed'};
    const downloadHost=response.headers.get('x-marcell-download-host')||'';
    await report({phase:stages[failure.error]||'reader-other-failure',httpStatus:response.status,...(downloadHost?{downloadHost}:{})});continue;
   }
   const blob=await response.blob(),bytes=new Uint8Array(await blob.arrayBuffer());
   const size=Number(original.tamanho||0);
   if(bytes[0]!==0xff||bytes[1]!==0xd8||(size&&bytes.length!==size)){result.originalErrors++;continue;}
   result.originalsRead++;
   const image=await createImageBitmap(blob);if(image.width>0&&image.height>0)result.imagesDecoded++;image.close();
  }
  await report(result);
 })().catch(()=>report({phase:'verification-failed'}));
}
