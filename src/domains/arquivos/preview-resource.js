import { protectedDocumentReference } from '../financeiro/document-links.js';
import { fileUrl } from './model.js';
export const PREVIEW_MAX_BYTES=25*1024*1024;
export function binaryPreviewKind(bytes,mime='') {
  const header=new TextDecoder().decode(bytes.subarray(0,16));
  if(header.startsWith('%PDF-'))return 'pdf';
  if((bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)||(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||header.startsWith('GIF8')||(header.startsWith('RIFF')&&header.slice(8,12)==='WEBP'))return 'image';
  if(/^text\/(plain|csv)|^(application|text)\/xml/.test(mime))return 'text';
  return 'unsupported';
}
export async function loadPreviewResource(revision,{resolveFile,fetchProtected,signal,fetchFile=fetch}={}) {
  let url=fileUrl(revision.url);
  const reference=revision.driveId&&revision.itemId?{driveId:revision.driveId,itemId:revision.itemId}:protectedDocumentReference(url);
  const localId=url?.match(/^\/api\/local-files\/([a-f0-9-]{36})$/)?.[1];
  let response;
  if(fetchProtected&&(reference||localId))response=await fetchProtected(reference||{localId},{signal});
  else if(reference){
    const result=await resolveFile(reference);
    if(!result?.ok)throw Object.assign(new Error(result?.error||'Não foi possível preparar o documento. Confira sua sessão e tente novamente.'),{status:result?.status});
    url=fileUrl(result.url);
  }
  if(!url)throw new Error('Este documento não possui um arquivo disponível para consulta.');
  response||=await fetchFile(url,{signal});
  if(!response.ok)throw new Error(response.status===401||response.status===403?'Sua sessão não permite ler este documento. Renove o acesso e tente novamente.':'O documento não está disponível. Tente novamente ou confira o anexo na etapa de origem.');
  if(Number(response.headers.get('content-length'))>PREVIEW_MAX_BYTES)throw new Error('Este arquivo excede o limite de 25 MB do visualizador.');
  const blob=await response.blob();
  if(blob.size>PREVIEW_MAX_BYTES)throw new Error('Este arquivo excede o limite de 25 MB do visualizador.');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const kind=binaryPreviewKind(bytes,blob.type);
  if(kind==='unsupported'&&/text\/html/i.test(blob.type))throw new Error('O endereço retornou uma página de acesso em vez do arquivo. Confira o anexo na etapa de origem.');
  return {kind,blob:kind==='pdf'?new Blob([bytes],{type:'application/pdf'}):blob,text:kind==='text'?new TextDecoder().decode(bytes.subarray(0,500000)):null};
}
