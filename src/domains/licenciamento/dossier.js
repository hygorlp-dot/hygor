import {licencaPorId} from './catalog.js';
import {fileUrl} from '../arquivos/model.js';
import {licensingDocumentContext} from '../arquivos/licensing-documents.js';
export const DOSSIER_COMMAND={ITEM_SAVED:'DOSSIE_ITEM_SALVO',ATTACHMENT_ADDED:'DOSSIE_ANEXO_ADICIONADO',EXPORT_RECORDED:'DOSSIE_EXPORTACAO_REGISTRADA'};
export const DOSSIER_COMMAND_TYPES=new Set(Object.values(DOSSIER_COMMAND));
export const slug=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'').toUpperCase().slice(0,45)||'DOCUMENTO';
export function dossierName(work,item,slot,revision,original){const ext=String(original||'').split('.').at(-1).toLowerCase();return `${slug(work.name).slice(0,28)}_${slug(item.area)}_${slug(item.id).slice(0,30)}_${String(slot).padStart(2,'0')}_R${String(revision).padStart(2,'0')}.${/^[a-z0-9]{1,8}$/.test(ext)?ext:'bin'}`;}
export function attachmentRevisions(doc){return doc.revisions?.length?doc.revisions:[{id:doc.id,label:'R01',url:doc.url,fileName:doc.nome||doc.fileName,originalName:doc.originalName||doc.nome,mime:doc.tipo||doc.mime,size:doc.tamanho||doc.size,createdAt:doc.enviadoEm,driveId:doc.driveId,itemId:doc.itemId,kind:'file'}];}
export function dossierItems(license={}){
  const definitions=licencaPorId(license.tipo).docs;
  const extra=Object.keys(license.itens||{}).filter(id=>!definitions.some(item=>item.id===id)).map(id=>({id,nome:licensingDocumentContext(license,id,license.itens[id]).stage,quando:'adicional',optional:true}));
  return [...definitions,...extra].map(definition=>{const stored=license.itens?.[definition.id]||{},context=licensingDocumentContext(license,definition.id,stored);return {...definition,...stored,id:definition.id,name:definition.nome,area:context.area,required:definition.quando==='sempre',documents:(stored.documentos||[]).filter(doc=>doc&&typeof doc==='object')};});
}
export function dossierCheck(license,now=new Date().toISOString()){
  const items=dossierItems(license);const missing=[];const day=now.slice(0,10);
  for(const item of items){
    if(item.optional)continue;
    if(item.status==='na'){if(!item.naReason?.trim())missing.push({id:item.id,name:item.name,reason:'Informe a justificativa de não aplicação.'});continue;}
    if(!item.required&&!['sim','nao'].includes(item.applicability)){missing.push({id:item.id,name:item.name,reason:'Defina se esta exigência condicional se aplica.'});continue;}
    if(!item.required&&item.applicability==='nao'){if(!item.naReason?.trim())missing.push({id:item.id,name:item.name,reason:'Justifique a não aplicação.'});continue;}
    const latest=item.documents.map(doc=>attachmentRevisions(doc).at(-1));
    if(!latest.length||latest.some(doc=>!fileUrl(doc.url)))missing.push({id:item.id,name:item.name,reason:'Documento obrigatório não anexado ou sem arquivo válido.'});
    else if(item.expiresAt&&item.expiresAt<day)missing.push({id:item.id,name:item.name,reason:'Documento vencido.'});
    else if(!['entregue','aprovado'].includes(item.status))missing.push({id:item.id,name:item.name,reason:'Aguarda conferência do documento.'});
  }
  return {items,missing,complete:missing.length===0};
}
export function dossierFiles(license,work){
  const items=[...dossierItems(license),{id:'documentos_gerais',area:'prefeitura',documents:license.documentos||[]}],used=new Set();
  return items.flatMap(item=>item.documents.filter(doc=>doc&&typeof doc==='object').map((doc,index)=>{const revisions=attachmentRevisions(doc),revision=revisions.at(-1);let name=dossierName(work,item,index+1,revisions.length,revision.fileName||doc.nome);while(used.has(name))name=`EXTRA_${name}`;used.add(name);return {itemId:item.id,documentId:doc.id||`${item.id}-${index}`,revisionId:revision.id||`${item.id}-${index}-original`,revision,originalName:revision.originalName||revision.fileName,name,area:item.area};}));
}
export function applyDossierCommand(data,command,now){
  if(!DOSSIER_COMMAND_TYPES.has(command.type))return null;
  const fail=reason=>({ok:false,reason}),p=command.payload||{},work=data.obras?.find(item=>item.id===p.obraId);
  if(!work||!['admin','engenheiro'].includes(command.actorRole)||!command.actorId)return fail('Seu perfil não pode alterar o dossiê desta obra.');
  const current=data.licencas?.find(item=>item.obraId===p.obraId);
  if(Number(command.expectedVersion)!==Number(current?.version||0))return fail('O dossiê foi alterado. Atualize os dados antes de continuar.');
  let license={...(current||{id:p.licenseId,obraId:p.obraId,tipo:'simplificada',itens:{}})};
  if(!license.id)return fail('Dossiê sem identificação.');
  const item=dossierItems(license).find(item=>item.id===p.itemId);
  if(command.type===DOSSIER_COMMAND.EXPORT_RECORDED){
    if(!['final','partial'].includes(p.mode))return fail('Tipo de exportação inválido.');
    const check=dossierCheck(license,now);if(p.mode==='final'&&!check.complete)return fail('Dossiê final bloqueado: existem documentos pendentes.');
    const files=dossierFiles(license,work),ids=files.map(file=>`${file.itemId}:${file.documentId}:${file.revisionId}`);
    if(!Array.isArray(p.files)||JSON.stringify([...ids].sort())!==JSON.stringify([...p.files].sort()))return fail('Os anexos do dossiê mudaram. Gere o ZIP novamente.');
    const failures=Array.isArray(p.failures)?p.failures:[];
    if(failures.some(failure=>!files.some(file=>file.name===failure.name))||(p.mode==='final'&&failures.length))return fail('A exportação final não pode conter falhas de leitura.');
    license.exports=[...(license.exports||[]),{id:command.idempotencyKey,at:now,actorId:command.actorId,mode:p.mode,files:ids,missing:[...check.missing,...failures.map(item=>({name:String(item.name).slice(0,200),reason:String(item.reason||'Falha ao ler o anexo.').slice(0,500)}))]}];
  }else{
    if(!item)return fail('Exigência não encontrada.');let stored={...(license.itens?.[item.id]||{})};
    if(command.type===DOSSIER_COMMAND.ITEM_SAVED){
      if(!['pendente','entregue','aprovado','na'].includes(p.status)||!['','sim','nao'].includes(p.applicability||''))return fail('Situação inválida.');
      if((p.status==='na'||p.applicability==='nao')&&!String(p.naReason||'').trim())return fail('Informe por que esta exigência não se aplica.');
      if(p.expiresAt&&!/^\d{4}-\d{2}-\d{2}$/.test(p.expiresAt))return fail('Validade inválida.');
      stored={...stored,status:p.status,applicability:p.applicability||'',naReason:String(p.naReason||'').trim().slice(0,2000),responsible:String(p.responsible||'').trim().slice(0,150),expiresAt:p.expiresAt||'',notes:String(p.notes||'').trim().slice(0,2000)};
    }else{
      const documents=stored.documentos||[],existing=documents.find(doc=>doc.id===p.documentId),revisions=existing?attachmentRevisions(existing):[];
      const r=p.revision||{};if(!p.documentId||!r.id||!fileUrl(r.url)||!r.fileName||!r.originalName||!Number.isInteger(r.size)||r.size<=0||r.size>20*1024*1024)return fail('Anexo inválido ou maior que 20 MB.');
      if(revisions.some(doc=>doc.id===r.id))return fail('Esta revisão já existe.');
      const revision={id:String(r.id),url:fileUrl(r.url),fileName:String(r.fileName).slice(0,200),originalName:String(r.originalName).slice(0,200),mime:String(r.mime||'').slice(0,120),size:r.size,driveId:String(r.driveId||''),itemId:String(r.itemId||''),label:`R${String(revisions.length+1).padStart(2,'0')}`,kind:'file',createdAt:now,createdById:command.actorId,createdByName:command.actorName||''};
      const doc={id:p.documentId,nome:revision.fileName,originalName:revision.originalName,url:revision.url,tipo:revision.mime,tamanho:revision.size,enviadoEm:now,driveId:revision.driveId,itemId:revision.itemId,revisions:[...revisions,revision]};
      stored={...stored,status:'entregue',documentos:existing?documents.map(item=>item.id===existing.id?doc:item):[...documents,doc]};
    }
    license.itens={...license.itens,[item.id]:stored};
  }
  license={...license,version:Number(current?.version||0)+1,updatedAt:now,createdAt:current?.createdAt||now,history:[...(license.history||[]),{id:command.idempotencyKey,type:command.type,itemId:p.itemId||'',actorId:command.actorId,actorName:command.actorName||'',at:now}]};
  return {ok:true,entityId:license.id,data:{...data,licencas:current?data.licencas.map(item=>item.obraId===p.obraId?license:item):[...(data.licencas||[]),license]}};
}
