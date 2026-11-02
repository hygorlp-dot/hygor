import {temSessao,statusOneDrive,loadDataWithMeta,listarPastaOneDrive,obterLinkArquivoOneDrive} from '../src/api.js';
import {documentRegister} from '../src/domains/financeiro/document-register.js';
import {protectedDocumentReference} from '../src/domains/financeiro/document-links.js';
import {rankOriginalCandidate,proposedOriginalCorrection} from './onedrive-link-candidates.mjs';

// One-off inspection using ordinary authenticated ERP helpers. No credential
// access, writes or arbitrary Graph proxy. Results stay in the local collector.
if(import.meta.env.DEV&&location.origin==='http://127.0.0.1:4192'){
 const report=async value=>{
  const response=await fetch('http://127.0.0.1:4194/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
  if(!response.ok)throw Error('Local collector unavailable');
 };
 (async()=>{
  for(let i=0;i<90&&!temSessao();i++)await new Promise(resolve=>setTimeout(resolve,1000));
  if(!temSessao())return report({phase:'erp-login-required'});
  const status=await statusOneDrive();
  if(!status.localReview)return; // Ignore isolated browser fixtures.
  if(!status.connected)return report({phase:'connection-required'});
  const {data}=await loadDataWithMeta();if(!data)return report({phase:'data-unavailable'});
  const targets=[];
  for(const row of documentRegister(data,{obraId:'all',competence:''}))for(const doc of row.docs){
   const ref=protectedDocumentReference(doc.url||doc.webUrl);if(!ref)continue;
   const existing=await obterLinkArquivoOneDrive(ref);
   let originalDownloadStatus=0,originalDownloadError='';
   if(existing.ok){const download=await fetch(existing.url);originalDownloadStatus=download.status;
    if(!download.ok){const failure=await download.json().catch(()=>({}));originalDownloadError=String(failure.error||'').slice(0,300);}
   }
   targets.push({sourceType:row.type,recordId:row.record.id,recordNumber:row.record.numero||'',workId:row.entry.obraId,
    work:row.entry.obra,date:row.entry.date||'',documentId:doc.id,name:doc.nome||doc.name||doc.legenda||'',
    size:Number(doc.tamanho||doc.size||0),uploadedAt:doc.enviadoEm||'',linkStatus:existing.status||0,originalDownloadStatus,originalDownloadError,...ref});
  }
  const works=(data.obras||[]).filter(w=>w.oneDriveDriveId&&w.oneDriveFolderId);
  const targetWorks=works.filter(w=>targets.some(t=>t.workId===w.id));
  const result={phase:'searching',targets:targets.length,foldersRead:0,filesRead:0,errors:[],truncated:false,proposals:targets.map(t=>proposedOriginalCorrection(t,[]))};
  await report(result);
  const candidates=targets.map(()=>[]),seen=new Set();
  async function search(scope){
   const queue=scope.map(w=>({work:w,id:w.oneDriveFolderId,path:w.name,depth:0}));
   while(queue.length&&result.foldersRead<600){
    const batch=queue.splice(0,3);
    const listings=await Promise.all(batch.map(async folder=>{
     const key=`${folder.work.oneDriveDriveId}:${folder.id}`;
     if(seen.has(key))return null;seen.add(key);
     return {folder,response:await listarPastaOneDrive({driveId:folder.work.oneDriveDriveId,parentId:folder.id})};
    }));
    for(const listing of listings){
     if(!listing)continue;
     const {folder,response}=listing;result.foldersRead++;
     if(!response.ok){result.errors.push({workId:folder.work.id,folderId:folder.id,httpStatus:response.status||0});continue;}
     for(const item of response.items||[]){
      const path=`${folder.path}/${item.name}`;
      if(item.type==='folder'){
       if(folder.depth<8)queue.push({work:folder.work,id:item.id,path,depth:folder.depth+1});else result.truncated=true;
       continue;
      }
      result.filesRead++;
      const file={id:item.id,driveId:folder.work.oneDriveDriveId,name:item.name,size:item.size,path,lastModifiedDateTime:item.lastModifiedDateTime,workId:folder.work.id};
      targets.forEach((original,index)=>{const rank=rankOriginalCandidate(original,file);if(rank)candidates[index].push({...file,...rank});});
     }
    }
    if(result.foldersRead%12<3)await report({...result,proposals:targets.map((t,i)=>proposedOriginalCorrection(t,candidates[i]))});
   }
   if(queue.length)result.truncated=true;
  }
  await search(targetWorks);
  if(targets.some((_,i)=>!candidates[i].some(c=>c.score>=90)))await search(works.filter(w=>!targetWorks.includes(w)));
  for(let i=0;i<targets.length;i++){
   candidates[i].sort((a,b)=>b.score-a.score);
   for(const candidate of candidates[i].filter(c=>c.score>=90).slice(0,10)){
    const link=await obterLinkArquivoOneDrive({driveId:candidate.driveId,itemId:candidate.id});
    if(!link.ok){candidate.downloadStatus=link.status||0;continue;}
    const response=await fetch(link.url);candidate.downloadStatus=response.status;
    if(response.ok){const bytes=new Uint8Array(await response.arrayBuffer());candidate.contentVerified=bytes.length>2&&((bytes[0]===0xff&&bytes[1]===0xd8)||(bytes[0]===0x89&&bytes[1]===0x50)||(bytes[0]===0x25&&bytes[1]===0x50));candidate.verifiedSize=bytes.length;}
   }
  }
  result.phase='complete';result.proposals=targets.map((t,i)=>proposedOriginalCorrection(t,candidates[i].slice(0,30)));
  await report(result);
 })().catch(()=>report({phase:'inspection-failed'}).catch(()=>{}));
}
