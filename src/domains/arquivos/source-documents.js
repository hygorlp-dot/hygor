import { documentRegister } from '../financeiro/document-register.js';
import { protectedDocumentReference } from '../financeiro/document-links.js';
import { fileUrl } from './model.js';
import { licensingDocumentContext } from './licensing-documents.js';

// Read the already-authorized projection. Originals remain owned by their module.
export function sourceDocuments(data, obraId) {
  const rows=[];
  const add=(id,name,source,raw,at='',revisions=[],context={})=>{
    const url=fileUrl(raw.url||raw.webUrl),drive=raw.driveId||raw.parentReference?.driveId;
    const info={reference:protectedDocumentReference(url)||(drive&&raw.id?{driveId:String(drive),itemId:String(raw.id)}:null)};
    if (!url&&!info.reference) return;
    rows.push({id,name,source,readOnly:true,folderId:'',updatedAt:at,...context,revisions:revisions.length?revisions:[{id,label:'Original',url:url||'',...info.reference,kind:info.reference||raw.tipo||raw.mime?'file':'link',fileName:raw.nome||raw.name||raw.fileName||name,mime:raw.tipo||raw.mime||raw.mimeType||'',size:raw.tamanho||raw.size||0,createdAt:raw.enviadoEm||at,note:`Documento vinculado a ${source}.`} ]});
  };
  for (const project of (data.engineeringProjects||[]).filter(item=>item.obraId===obraId)) {
    for (const link of project.links||[]) {
      const revisions=(project.revisions||[]).filter(item=>item.linkId===link.id&&fileUrl(item.url)).map(item=>({...item,label:item.number?`R${String(item.number).padStart(2,'0')}`:item.code||item.label||item.version||'Revisão',note:item.description||item.summary||'',createdByName:item.createdBy,createdAt:item.createdAt,kind:'link'}));
      add(`project:${project.id}:${link.id}`,link.title||link.name||project.name,'Projetos',link,project.updatedAt,revisions);
    }
  }
  for (const row of documentRegister(data,{obraId})) row.docs.forEach((doc,index)=>add(`finance:${row.id}:${index}`,doc.name||doc.fileName||`${row.label} · ${row.record.numero||row.record.id}`,'Financeiro',doc,row.entry.date));
  for(const license of (data.licencas||[]).filter(item=>item.obraId===obraId)){
    for(const [key,item] of Object.entries(license.itens||{}))for(const [index,raw] of (item?.documentos||[]).entries()){
      const doc=typeof raw==='string'?{url:raw}:raw;if(!doc)continue;
      add(`license:${license.id}:${key}:${doc.id||index}`,doc.nome||doc.name||doc.fileName||'Anexo do licenciamento','Licenciamento',{driveId:license.workspace?.driveId,...doc},doc.enviadoEm||license.updatedAt,[],licensingDocumentContext(license,key,item,doc));
    }
    for(const [index,doc] of (license.documentos||[]).entries())if(doc)add(`license:${license.id}:general:${doc.id||index}`,doc.nome||doc.name||'Documento do licenciamento','Licenciamento',{driveId:license.workspace?.driveId,...doc},license.updatedAt,[],licensingDocumentContext(license,'documentos',{},doc));
  }
  const collections=[['rdos','Diário e fotos'],['conferencias','Conferência'],['qualidadeRegistros','Conferência'],['medicoesObra','Medições'],['medicoesTerc','Medições'],['contratosTerceirizados','Contratos'],['terceirizados','Contratos'],['contratosFornecimento','Contratos'],['workPermits','Licenciamento']];
  for (const [key,label] of collections) for (const record of (data[key]||[]).filter(item=>item.obraId===obraId)) {
    const attachments=[...(record.documentos||[]),...(record.anexos||[]),...(record.fotos||[]),...Object.values(record.itens||{}).flatMap(item=>[...(item?.documentos||[]),...(item?.fotos||[])])];
    attachments.forEach((raw,index)=>{const doc=typeof raw==='string'?{url:raw}:raw;if(doc)add(`${key}:${record.id}:${index}`,doc.name||doc.nome||doc.fileName||`${label} · ${record.data||record.id}`,label,{driveId:record.workspace?.driveId,...doc},record.data||record.createdAt);});
  }
  const obra=(data.obras||[]).find(item=>item.id===obraId);
  if (obra?.oneDriveUrl) add(`work:${obraId}`,'Pasta de documentos da obra','Obra',{url:obra.oneDriveUrl});
  return rows;
}
