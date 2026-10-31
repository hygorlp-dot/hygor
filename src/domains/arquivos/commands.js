import { DEFAULT_FOLDERS, fileUrl, FILE_MAX_BYTES, FILE_EXTENSIONS, folderPath } from './model.js';
export const FILE_COMMAND = Object.freeze({ FOLDER_SAVED:'ARQUIVOS_PASTA_SALVA', TEMPLATE_APPLIED:'ARQUIVOS_MODELO_APLICADO', DOCUMENT_ADDED:'ARQUIVOS_DOCUMENTO_ADICIONADO', REVISION_ADDED:'ARQUIVOS_REVISAO_ADICIONADA', DOCUMENT_MOVED:'ARQUIVOS_DOCUMENTO_MOVIDO' });
export const FILE_COMMAND_TYPES = new Set(Object.values(FILE_COMMAND));
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
  const parentId=text(p.parentId), folderId=text(p.folderId);
  const folderExists=id=>!id||cabinet.folders.some(item=>item.id===id);
  let detail='';
  if (command.type===FILE_COMMAND.TEMPLATE_APPLIED) {
    const additions=DEFAULT_FOLDERS.filter(name=>!cabinet.folders.some(item=>!item.parentId&&item.name===name)).map((name,index)=>({id:`${command.idempotencyKey}:${index}`,name,parentId:'',createdAt:now}));
    cabinet.folders=[...cabinet.folders,...additions]; detail='Estrutura padrão de pastas aplicada';
  } else if (command.type===FILE_COMMAND.FOLDER_SAVED) {
    const id=text(p.id),name=text(p.name);
    if (!id || ['*','sources'].includes(id) || !name || !folderExists(parentId)) return fail('Informe o nome e uma pasta de destino válida.');
    if (id===parentId || folderPath(cabinet.folders,parentId).some(item=>item.id===id)) return fail('Uma pasta não pode ficar dentro dela mesma ou de suas subpastas.');
    if (folderPath(cabinet.folders,parentId).length>=8) return fail('Use no máximo oito níveis de pastas.');
    if (cabinet.folders.some(item=>item.id!==id&&item.parentId===parentId&&item.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))) return fail('Já existe uma pasta com esse nome neste local.');
    const existing=cabinet.folders.find(item=>item.id===id);
    const folder={id,name,parentId,createdAt:existing?.createdAt||now,updatedAt:now};
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
      const revision={id:text(p.revisionId),label,note,url,kind,size:kind==='file'?p.size:0,fileName:kind==='file'?text(p.fileName):'',mime:text(p.mime),driveId:text(p.driveId),itemId:text(p.itemId),createdAt:now,createdById:command.actorId,createdByName:text(command.actorName)};
      const document=existing?{...existing,revisions:[...existing.revisions,revision],updatedAt:now}:{id:text(p.id),name,folderId,createdAt:now,updatedAt:now,revisions:[revision]};
      cabinet.documents=existing?cabinet.documents.map(item=>item.id===p.id?document:item):[...cabinet.documents,document]; detail=`${existing?'Nova revisão':'Documento criado'}: ${document.name} · ${label}`;
    }
  }
  cabinet={...cabinet,version:cabinet.version+1,updatedAt:now,history:[...cabinet.history,{id:command.idempotencyKey,type:command.type,detail,at:now,actorId:command.actorId,actorName:text(command.actorName)}]};
  return {ok:true,entityId:p.obraId,data:{...data,workFileCabinets:current?cabinets.map(item=>item.obraId===p.obraId?cabinet:item):[...cabinets,cabinet]}};
}
