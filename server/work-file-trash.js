import {seal,unseal} from './microsoft/graph.js';
import {knownWorkspace} from './onedrive-scope.js';
import {validateFileCabinetScope} from './work-file-cabinet-policy.js';
import {FILE_COMMAND} from '../src/domains/arquivos/commands.js';
import {documentTrashReferences} from '../src/domains/arquivos/trash.js';

const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
export function verifiedFileTrashCommand(command) {
  // A browser-supplied proof object is always discarded. Only the sealed receipt is trusted.
  return {...command,fileTrashProof:process.env.MICROSOFT_CLIENT_SECRET&&command.type===FILE_COMMAND.DOCUMENT_TRASH_COMPLETED?unseal(String(command.payload?.receipt||'')):null};
}
export async function trashWorkDocument({data,user,body,getToken,graph,now=new Date().toISOString()}) {
  if(!process.env.MICROSOFT_CLIENT_SECRET)fail('A conexão segura do OneDrive não está configurada.',503);
  const scope=validateFileCabinetScope({data,user,command:{type:FILE_COMMAND.DOCUMENT_TRASH_REQUESTED,payload:{obraId:body.obraId,id:body.id}}});
  if(!scope.ok)fail(scope.error,403);
  const cabinet=data.workFileCabinets?.find(item=>item.obraId===body.obraId);
  const document=cabinet?.documents?.find(item=>item.id===body.id);
  if(!document||!document.trash||document.trash.operationId!==body.operationId)fail('Confirme a exclusão deste documento na central antes de continuar.');
  const references=documentTrashReferences(document);
  const receipt=()=>seal({kind:'work-file-trash-v1',obraId:body.obraId,documentId:document.id,operationId:body.operationId,actorId:user.id,references,expiresAt:new Date(Date.parse(now)+86400000).toISOString()});
  if(document.deletedAt)return {ok:true,receipt:receipt(),files:references.length};
  const workspace=knownWorkspace((data.obras||[]).find(item=>item.id===body.obraId)||{});
  if(references.some(ref=>ref.driveId!==workspace.driveId||ref.itemId===workspace.folderId)||references.length&&!workspace.folderId)fail('Uma revisão não pertence à pasta protegida desta obra.',403);
  if(!references.length)return {ok:true,receipt:receipt(),files:0};
  const token=await getToken();
  const items=[];
  // Preflight every revision before recycling any item. Never delete folders.
  for(const ref of references) {
    const path=`/drives/${encodeURIComponent(ref.driveId)}/items/${encodeURIComponent(ref.itemId)}`;
    let item;
    try {item=await (await graph(token,`${path}?$select=id,file,folder,parentReference,eTag`)).json();}
    catch(error){if(error.status===404)continue;throw error;}
    if(item.id!==ref.itemId||!item.file||item.folder||!item.eTag)fail('O OneDrive não confirmou a identidade de uma revisão. Confira o documento antes de concluir a exclusão.',502);
    let parent=item.parentReference?.id;const visited=new Set();
    while(parent&&parent!==workspace.folderId&&visited.size<16&&!visited.has(parent)) {
      visited.add(parent);parent=(await (await graph(token,`/drives/${encodeURIComponent(ref.driveId)}/items/${encodeURIComponent(parent)}?$select=id,parentReference`)).json()).parentReference?.id;
    }
    if(parent!==workspace.folderId)fail('Uma revisão está fora da pasta protegida desta obra.',403);
    items.push({path,eTag:item.eTag});
  }
  for(const item of items) {
    try {const result=await graph(token,item.path,{method:'DELETE',headers:{'If-Match':item.eTag}});if(result.status!==204)fail('O OneDrive não confirmou o envio à lixeira. Tente concluir a exclusão novamente.',502);}
    catch(error){if(error.status!==404)throw error;}
  }
  return {ok:true,receipt:receipt(),files:references.length};
}
