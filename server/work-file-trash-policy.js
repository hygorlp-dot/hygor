import {sourceDocuments} from '../src/domains/arquivos/source-documents.js';
import {documentTrashReferences,referenceKey,revisionReference,hasPreservedDocumentLink} from '../src/domains/arquivos/trash.js';

export function fileTrashBlockReason(data,obraId,id) {
  const document=data.workFileCabinets?.find(item=>item.obraId===obraId)?.documents?.find(item=>item.id===id);
  if(!document||document.deletedAt)return '';
  if(hasPreservedDocumentLink(data,obraId,id))return 'Este documento está preservado em um contrato comercial. Confira o vínculo no módulo de origem.';
  let references;
  try{references=documentTrashReferences(document);}catch(error){return error.message;}
  const keys=new Set(references.map(referenceKey));
  const others=(data.workFileCabinets||[]).flatMap(item=>(item.documents||[]).filter(doc=>doc!==document&&!doc.deletedAt));
  for(const work of data.obras||[])others.push(...sourceDocuments(data,work.id));
  return others.some(doc=>(doc.revisions||[]).some(revision=>{const ref=revisionReference(revision);return ref&&keys.has(referenceKey(ref));}))
    ?'Uma revisão também está vinculada a outro documento ou módulo. Confira a origem antes de excluir.':'';
}
