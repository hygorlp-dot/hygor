import {documentTrashReferences,revisionReference,referenceKey,trashProofMatches,hasPreservedDocumentLink} from './trash.js';
import { DEFAULT_FOLDERS, DEFAULT_PROJECT_FOLDERS, sameFolderName, fileUrl, FILE_MAX_BYTES, FILE_BATCH_MAX, FILE_EXTENSIONS, folderPath } from './model.js';
import { folderAccess } from './access.js';
export const FILE_COMMAND = Object.freeze({ FOLDER_SAVED:'ARQUIVOS_PASTA_SALVA', FOLDER_ACCESS_CHANGED:'ARQUIVOS_PERMISSAO_ALTERADA', TEMPLATE_APPLIED:'ARQUIVOS_MODELO_APLICADO', DOCUMENT_ADDED:'ARQUIVOS_DOCUMENTO_ADICIONADO', DOCUMENTS_ADDED:'ARQUIVOS_LOTE_ADICIONADO', REVISION_ADDED:'ARQUIVOS_REVISAO_ADICIONADA', DOCUMENT_MOVED:'ARQUIVOS_DOCUMENTO_MOVIDO', DOCUMENT_TRASH_REQUESTED:'ARQUIVOS_EXCLUSAO_SOLICITADA', DOCUMENT_TRASH_COMPLETED:'ARQUIVOS_EXCLUSAO_CONCLUIDA' });
export const FILE_BATCH_COMMAND = FILE_COMMAND.DOCUMENTS_ADDED;
export const FILE_COMMAND_TYPES = new Set([...Object.values(FILE_COMMAND),FILE_BATCH_COMMAND]);
export const FILE_ROLES = ['admin','engenheiro','engenheiro_auditor','compras','financeiro','rh','comercial'];
const text = (value, max=200) => String(value || '').trim().slice(0,max);
const fail = reason => ({ok:false,reason});
export function applyFileCommand(data, command, now) {
  if (!FILE_COMMAND_TYPES.has(command.type)) return null;
  const p=command.payload||{}, cabinets=data.workFileCabinets||[];
  if (!command.actorId || !FILE_ROLES.includes(command.actorRole) || !Number.isFinite(Date.parse(now))) return fail('Sessão ou horário inválido.');
  const current=cabinets.find(item=>item.obraId===p.obraId);
  if (current?.history?.some(event=>event.id===command.idempotencyKey)) return {ok:true,idempotent:true,data,entityId:current.obraId};
  if (!(data.obras||[]).some(item=>item.id===p.obraId)) return fail('Obra não encontrada.');
  if (Number(command.expectedVersion)!==Number(current?.version||0)) return fail('Os arquivos desta obra foram alterados. Atualize os dados e tente novamente.');
  let cabinet=current?{...current}:{obraId:p.obraId,folders:[],documents:[],history:[],version:0};
  const actor={id:command.actorId,role:command.actorRole};
  const existingDocument=cabinet.documents.find(item=>item.id===p.id);
  const existingFolder=cabinet.folders.find(item=>item.id===p.id);
  const protectedFolders=[existingDocument?.folderId,existingFolder?.id,p.folderId,p.parentId].filter(id=>id!=null);
  if(!protectedFolders.every(id=>folderAccess(cabinet,id,actor,'write')))return fail('Você não tem permissão para alterar esta pasta ou seus documentos.');
  const parentId=text(p.parentId), folderId=text(p.folderId);
  const folderExists=id=>!id||cabinet.folders.some(item=>item.id===id);
  let detail='';
  if(existingDocument?.deletedAt)return fail('Este documento já foi excluído. Atualize a tela.');
  if(existingDocument?.trash&&![FILE_COMMAND.DOCUMENT_TRASH_REQUESTED,FILE_COMMAND.DOCUMENT_TRASH_COMPLETED].includes(command.type))return fail('Este documento tem uma exclusão pendente. Conclua a exclusão antes de alterar.');
  if(command.type===FILE_COMMAND.DOCUMENT_TRASH_REQUESTED) {
    if(hasPreservedDocumentLink(data,p.obraId,p.id))return fail('Este documento está preservado em um contrato comercial. Confira o vínculo no módulo de origem.');
    if(!existingDocument)return fail('Documento não encontrado nesta central. Os vínculos dos módulos são somente leitura.');
    if(!/^[a-zA-Z0-9_-]{16,200}$/.test(String(p.operationId||'')))return fail('Identificação da exclusão inválida.');
    if(existingDocument.trash)return existingDocument.trash.operationId===p.operationId?{ok:true,idempotent:true,data,entityId:p.obraId}:fail('Já existe uma exclusão pendente para este documento. Atualize a tela.');
    try{documentTrashReferences(existingDocument);}catch(error){return fail(error.message);}
    cabinet.documents=cabinet.documents.map(item=>item.id===p.id?{...item,trash:{operationId:p.operationId,requestedAt:now,requestedBy:command.actorId},updatedAt:now}:item);
    detail=`Exclusão solicitada: ${existingDocument.name} · ${existingDocument.revisions.length} ${existingDocument.revisions.length===1?'revisão':'revisões'}`;
  } else if(command.type===FILE_COMMAND.DOCUMENT_TRASH_COMPLETED) {
    if(!existingDocument?.trash||!trashProofMatches(command.fileTrashProof,existingDocument,p.obraId,command.actorId,now))return fail('O servidor não confirmou o envio de todas as revisões à lixeira. Tente concluir a exclusão novamente.');
    cabinet.documents=cabinet.documents.map(item=>item.id===p.id?{...item,deletedAt:now,deletedBy:command.actorId,trash:{...item.trash,completedAt:now},updatedAt:now}:item);
    detail=`Documento excluído: ${existingDocument.name} · ${existingDocument.revisions.length} ${existingDocument.revisions.length===1?'revisão':'revisões'} · arquivos enviados à lixeira do OneDrive; links externos preservados`;
  } else if (command.type===FILE_BATCH_COMMAND) {
    const documents=p.documents;
    if(!Array.isArray(documents)||!documents.length||documents.length>FILE_BATCH_MAX||documents.some(item=>!item||typeof item!=='object'||Array.isArray(item)))return fail('Lote inválido. Envie até 20 arquivos.');
    if(new Set(documents.map(item=>text(item.id))).size!==documents.length||new Set(documents.map(item=>text(item.revisionId))).size!==documents.length)return fail('O lote contém identificações repetidas.');
    let staged=data,version=cabinet.version;
    for(const item of documents){
      const result=applyFileCommand(staged,{...command,type:FILE_COMMAND.DOCUMENT_ADDED,expectedVersion:version++,idempotencyKey:`${command.idempotencyKey}:${version}`,payload:{...item,id:text(item.id),revisionId:text(item.revisionId),obraId:p.obraId,folderId,kind:'file'}},now);
      if(!result.ok)return fail(result.reason);
      staged=result.data;
    }
    cabinet.documents=staged.workFileCabinets.find(item=>item.obraId===p.obraId).documents;
    detail=`Lote criado: ${documents.length} documentos`;
  } else if (command.type===FILE_COMMAND.FOLDER_ACCESS_CHANGED) {
    if(command.actorRole!=='admin'||!existingFolder)return fail('Somente o administrador pode alterar permissões de uma pasta existente.');
    const access=p.access||{},readers=access.readers,editors=access.editors;
    if(typeof access.restricted!=='boolean'||!Array.isArray(readers)||!Array.isArray(editors)||new Set(readers).size!==readers.length||new Set(editors).size!==editors.length||editors.some(id=>!readers.includes(id)))return fail('Defina leitores e editores válidos; todo editor deve poder ler.');
    if([...readers,...editors].some(id=>!(data.usuarios||[]).some(user=>user.id===id&&user.active!==false&&(!user.obraId||String(user.obraId)===String(p.obraId)))))return fail('Usuário não disponível para esta obra.');
    cabinet.folders=cabinet.folders.map(item=>item.id===p.id?{...item,access:{restricted:access.restricted,readers:[...readers],editors:[...editors]},updatedAt:now}:item);detail=`Permissões atualizadas: ${existingFolder.name}`;
  } else if (command.type===FILE_COMMAND.TEMPLATE_APPLIED) {
    const folders=[...cabinet.folders];
    for(const [index,name] of DEFAULT_FOLDERS.entries()){
      const matches=folders.filter(item=>!item.parentId&&sameFolderName(item.name,name));
      if(matches.length>1)return fail('Há pastas padrão duplicadas. Confira a organização antes de aplicar o modelo.');
      if(!matches.length)folders.push({id:`${command.idempotencyKey}:${index}`,name,parentId:'',createdAt:now});
    }
    const projects=folders.find(item=>!item.parentId&&sameFolderName(item.name,'Projetos'));
    for(const [index,name] of DEFAULT_PROJECT_FOLDERS.entries()){
      const matches=folders.filter(item=>item.parentId===projects.id&&sameFolderName(item.name,name));
      if(matches.length>1)return fail('Há subpastas de projetos duplicadas. Confira a organização antes de aplicar o modelo.');
      if(!matches.length){
        if(!folderAccess({...cabinet,folders},projects.id,actor,'write'))return fail('Você não tem permissão para completar a pasta Projetos.');
        folders.push({id:`${command.idempotencyKey}:project:${index}`,name,parentId:projects.id,createdAt:now});
      }
    }
    cabinet.folders=folders;detail='Estrutura padrão de pastas aplicada';
  } else if (command.type===FILE_COMMAND.FOLDER_SAVED) {
    const id=text(p.id),name=text(p.name);
    if (!id || ['*','sources'].includes(id) || !name || !folderExists(parentId)) return fail('Informe o nome e uma pasta de destino válida.');
    if (id===parentId || folderPath(cabinet.folders,parentId).some(item=>item.id===id)) return fail('Uma pasta não pode ficar dentro dela mesma ou de suas subpastas.');
    if (folderPath(cabinet.folders,parentId).length>=8) return fail('Use no máximo oito níveis de pastas.');
    if (cabinet.folders.some(item=>item.id!==id&&item.parentId===parentId&&item.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))) return fail('Já existe uma pasta com esse nome neste local.');
    const existing=cabinet.folders.find(item=>item.id===id);
    if(existing&&existing.parentId!==parentId&&command.actorRole!=='admin')return fail('Somente o administrador pode mover pastas; as permissões são herdadas da pasta superior.');
    const folder={id,name,parentId,...(existing?.access?{access:existing.access}:{}),createdAt:existing?.createdAt||now,updatedAt:now};
    cabinet.folders=existing?cabinet.folders.map(item=>item.id===id?folder:item):[...cabinet.folders,folder]; detail=`Pasta: ${name}`;
  } else {
    const existing=cabinet.documents.find(item=>item.id===p.id);
    if (command.type!==FILE_COMMAND.DOCUMENT_ADDED&&!existing) return fail('Documento não encontrado nesta obra.');
    if (!folderExists(folderId)) return fail('Pasta de destino não encontrada nesta obra.');
    if (command.type===FILE_COMMAND.DOCUMENT_MOVED) {
      cabinet.documents=cabinet.documents.map(item=>item.id===p.id?{...item,folderId,updatedAt:now}:item); detail=`Documento movido: ${existing.name}`;
    } else {
      const url=fileUrl(p.url),name=text(p.name),note=text(p.note,2000),label=text(p.label,60),kind=p.kind;
      if (!text(p.id)||!text(p.revisionId)||!url||!label||!['link','file'].includes(kind)||(!existing&&!name)) return fail('Informe título, revisão e um arquivo ou link válido.');
      if (kind==='link'&&!/^https?:\/\//i.test(url)) return fail('Informe um link HTTP ou HTTPS.');
      if (kind==='file'&&(!Number.isInteger(p.size)||p.size<=0||p.size>FILE_MAX_BYTES||!FILE_EXTENSIONS.includes(text(p.fileName).split('.').pop().toLowerCase()))) return fail('Arquivo inválido ou maior que 3 MB.');
      if (existing?.revisions.some(item=>item.label.toLowerCase()===label.toLowerCase())) return fail('Esta identificação de revisão já existe. Use uma nova revisão.');
      if (existing?.revisions.some(item=>item.id===p.revisionId)) return fail('Esta revisão já existe. Atualize a tela.');
      if (command.type===FILE_COMMAND.DOCUMENT_ADDED&&existing) return fail('Este documento já existe. Atualize a tela.');
      const incoming=revisionReference(p);
      if(incoming&&cabinets.some(c=>(c.documents||[]).some(doc=>doc.trash&&(doc.revisions||[]).some(rev=>{const ref=revisionReference(rev);return ref&&referenceKey(ref)===referenceKey(incoming);}))))return fail('Este arquivo pertence a um documento em exclusão. Envie um novo arquivo.');
      const revision={id:text(p.revisionId),label,note,url,kind,size:kind==='file'?p.size:0,fileName:kind==='file'?text(p.fileName):'',mime:text(p.mime),driveId:text(p.driveId),itemId:text(p.itemId),createdAt:now,createdById:command.actorId,createdByName:text(command.actorName)};
      const document=existing?{...existing,revisions:[...existing.revisions,revision],updatedAt:now}:{id:text(p.id),name,folderId,createdAt:now,updatedAt:now,revisions:[revision]};
      cabinet.documents=existing?cabinet.documents.map(item=>item.id===p.id?document:item):[...cabinet.documents,document]; detail=`${existing?'Nova revisão':'Documento criado'}: ${document.name} · ${label}`;
    }
  }
  cabinet={...cabinet,version:cabinet.version+1,updatedAt:now,history:[...cabinet.history,{id:command.idempotencyKey,type:command.type,detail,folderIds:[...new Set([...protectedFolders,...(command.type===FILE_COMMAND.FOLDER_SAVED?[p.id]:[])])],at:now,actorId:command.actorId,actorName:text(command.actorName)}]};
  return {ok:true,entityId:p.obraId,data:{...data,workFileCabinets:current?cabinets.map(item=>item.obraId===p.obraId?cabinet:item):[...cabinets,cabinet]}};
}
