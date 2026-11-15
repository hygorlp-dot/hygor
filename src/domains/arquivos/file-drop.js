import {fileValidation,FILE_BATCH_MAX} from './model.js';
export const isFileDrag = transfer => Array.from(transfer?.types||[]).includes('Files');
export function validateBatch(files) {
  if(!files.length||files.length>FILE_BATCH_MAX)return `Selecione de 1 a ${FILE_BATCH_MAX} arquivos por lote.`;
  return files.map(file=>{const error=file.name.length>200?'Encurte o nome para até 200 caracteres.':fileValidation(file);return error?`${file.name}: ${error}`:'';}).filter(Boolean).join(' ');
}
export function droppedFiles(transfer) {
  if(Array.from(transfer?.items||[]).some(item=>item.webkitGetAsEntry?.()?.isDirectory))return {error:'Arraste arquivos, não pastas.'};
  const files=Array.from(transfer?.files||[]),error=validateBatch(files);
  return error?{error}:{files};
}
export function droppedFile(transfer) {
  if(Array.from(transfer?.items||[]).some(item=>item.webkitGetAsEntry?.()?.isDirectory))return {error:'Arraste um arquivo por vez. Pastas não são aceitas.'};
  const files=Array.from(transfer?.files||[]);
  if(files.length!==1)return {error:'Arraste um arquivo por vez para conferir o título, a pasta e a revisão.'};
  const error=fileValidation(files[0]);
  return error?{error}:{file:files[0]};
}
