import {FILE_COMMAND as CMD,FILE_ROLES} from './commands.js';
import {folderAccess} from './access.js';
import {documentTrashReferences,hasPreservedDocumentLink} from './trash.js';

export function deletionBlock(data,cabinet,document,user) {
  if(document.readOnly)return 'Exclua no módulo de origem.';
  if(document.deletedAt)return 'Documento já excluído.';
  if(!FILE_ROLES.includes(user.role)||!folderAccess(cabinet,document.folderId,user,'write'))return 'Sem permissão de edição nesta pasta.';
  if(!cabinet.documents.some(item=>item.id===document.id))return 'Documento indisponível nesta central.';
  if(hasPreservedDocumentLink(data,cabinet.obraId,document.id))return 'Preservado em contrato comercial.';
  try{documentTrashReferences(document);}catch(error){return error.message;}
  return '';
}

// Reuse the authenticated, versioned single-document protocol. No client receipt
// can complete another document, and a failed document never rolls back others.
export async function trashDocumentBatch({data,obraId,documents,user,dispatchCommand,recycle,attempts,onProgress=()=>{}}) {
  let current=data;
  const results=[];
  const actor={actorId:user.id,actorRole:user.role,actorName:user.nome};
  for(const snapshot of documents) {
    const id=snapshot.id;
    onProgress({id,status:'Excluindo…'});
    try {
      const cabinet=current.workFileCabinets.find(item=>item.obraId===obraId);
      const document=cabinet?.documents.find(item=>item.id===id);
      if(!document)throw new Error('Documento indisponível. Atualize a lista.');
      const blocked=deletionBlock(current,cabinet,document,user);
      if(blocked)throw new Error(blocked);
      if(document.name!==snapshot.name||document.folderId!==snapshot.folderId||JSON.stringify(document.revisions)!==JSON.stringify(snapshot.revisions))throw new Error('O documento mudou. Atualize a lista e confira as revisões antes de excluir.');
      const operationId=document.trash?.operationId||attempts.get(id)||crypto.randomUUID();
      attempts.set(id,operationId);
      const payload={obraId,id,operationId};
      const started=await dispatchCommand({...actor,type:CMD.DOCUMENT_TRASH_REQUESTED,expectedVersion:cabinet.version,idempotencyKey:`${operationId}-request`,payload});
      if(!started?.ok)throw new Error(started?.reason||'A exclusão não foi iniciada. Atualize a lista.');
      if(started.data)current=started.data;
      const confirmed=current.workFileCabinets.find(item=>item.obraId===obraId);
      if(confirmed?.documents.find(item=>item.id===id)?.trash?.operationId!==operationId)throw new Error('A solicitação não foi confirmada pelo servidor. Atualize a lista.');
      const recycled=await recycle(payload);
      if(!recycled.ok||!recycled.receipt)throw new Error(recycled.error||'O OneDrive não confirmou todas as revisões. Tente novamente.');
      const completed=await dispatchCommand({...actor,type:CMD.DOCUMENT_TRASH_COMPLETED,expectedVersion:confirmed.version,idempotencyKey:`${operationId}-complete`,payload:{...payload,receipt:recycled.receipt}});
      if(!completed?.ok)throw new Error(completed?.reason||'Confira a conexão e tente concluir a exclusão.');
      if(completed.data)current=completed.data;
      if(!current.workFileCabinets.find(item=>item.obraId===obraId)?.documents.find(item=>item.id===id)?.deletedAt)throw new Error('A conclusão não foi confirmada. Atualize a lista.');
      results.push({id,ok:true,status:'Excluído'});
    } catch(error){results.push({id,ok:false,status:'Não concluído',error:error.message||'Confira a conexão e tente novamente.'});}
    onProgress(results.at(-1));
  }
  return results;
}
