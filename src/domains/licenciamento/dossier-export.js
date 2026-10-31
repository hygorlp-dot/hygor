import {dossierCheck,dossierFiles,slug} from './dossier.js';
export async function buildDossierZip({license,work,mode,readFile,onProgress=()=>{},now=new Date().toISOString()}){
  const check=dossierCheck(license,now);if(mode==='final'&&!check.complete)throw new Error('Dossiê final bloqueado: resolva as pendências.');
  const {default:JSZip}=await import('jszip');const zip=new JSZip(),files=dossierFiles(license,work),failed=[];let bytes=0;
  for(const [index,file] of files.entries()){
    onProgress(`Preparando arquivo ${index+1} de ${files.length}…`);
    try{const blob=await readFile(file.revision);bytes+=blob.size;if(bytes>100*1024*1024)throw new Error('O ZIP excede 100 MB.');zip.file(`${slug(file.area)}/${file.name}`,await blob.arrayBuffer());}
    catch(error){if(mode==='final')throw new Error(`Não foi possível incluir ${file.name}: ${error.message}`);failed.push({id:file.itemId,name:file.name,reason:error.message});}
  }
  const missing=[...check.missing,...failed],partial=mode==='partial';
  const manifest={workId:work.id,workName:work.name,licenseId:license.id,licenseVersion:license.version||0,createdAt:now,status:partial?'INCOMPLETO':'FINAL',missing,files:files.map(({revision,...file})=>({...file,included:!failed.some(item=>item.name===file.name),revision:revision.label}))};
  zip.file('MANIFESTO.json',JSON.stringify(manifest,null,2));
  const csv=value=>`"${String(value??'').replace(/^[=+@\-\t\r]/,"'").replaceAll('"','""')}"`;
  zip.file('INDICE.csv','\uFEFF'+[['Item','Arquivo','Nome original','Revisão','Incluído'],...manifest.files.map(file=>[file.itemId,file.name,file.originalName,file.revision,file.included?'Sim':'Não'])].map(row=>row.map(csv).join(';')).join('\r\n'));
  zip.file(partial?'PENDENCIAS.txt':'CONFERENCIA.txt',`${partial?'DOSSIE INCOMPLETO':'DOSSIE FINAL'}\nObra: ${work.name}\nGerado em: ${now}\n\n${missing.length?missing.map(item=>`${item.name}: ${item.reason}`).join('\n'):'Sem pendências documentais cadastradas.'}\n\nA conferência interna não substitui a análise do órgão responsável.`);
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
  return {blob,name:`DOSSIE_${slug(work.name)}_${partial?'INCOMPLETO':'FINAL'}_${now.slice(0,10)}.zip`,failures:failed,files:files.map(file=>`${file.itemId}:${file.documentId}:${file.revisionId}`)};
}
