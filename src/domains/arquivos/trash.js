// References come from persisted revisions, never from a deletion form.
export function revisionReference(revision={}) {
  if(revision.driveId&&revision.itemId)return {driveId:String(revision.driveId),itemId:String(revision.itemId)};
  try {
    if(!String(revision.url||'').startsWith('/api/microsoft/onedrive?'))return null;
    const url=new URL(revision.url,'https://local.invalid');
    if(url.pathname!=='/api/microsoft/onedrive')return null;
    const driveId=url.searchParams.get('driveId'),itemId=url.searchParams.get('itemId');
    return driveId&&itemId?{driveId,itemId}:null;
  } catch {return null;}
}
export const referenceKey=reference=>JSON.stringify([reference.driveId,reference.itemId]);
export const hasPreservedDocumentLink=(data,obraId,documentId)=>(data.commercialContractRecords||[]).some(record=>
  [record,...(record.revisions||[])].some(snapshot=>String(snapshot.obraId||record.obraId)===String(obraId)&&(snapshot.anexos||[]).some(ref=>ref.documentId===documentId)));
export function documentTrashReferences(document) {
  const unique=new Map();
  for(const revision of document.revisions||[]) {
    if(revision.kind!=='file')continue;
    const reference=revisionReference(revision);
    if(!reference)throw new Error('Uma revisão não tem identificação segura no OneDrive. Confira o documento antes de excluir.');
    if(reference)unique.set(referenceKey(reference),reference);
  }
  return [...unique.values()].sort((a,b)=>referenceKey(a).localeCompare(referenceKey(b)));
}
export function trashProofMatches(proof,document,obraId,actorId,now) {
  return !!proof&&proof.kind==='work-file-trash-v1'&&proof.obraId===obraId&&proof.documentId===document.id
    &&proof.operationId===document.trash?.operationId&&proof.actorId===actorId
    &&Date.parse(proof.expiresAt)>Date.parse(now)
    &&JSON.stringify(proof.references)===JSON.stringify(documentTrashReferences(document));
}
