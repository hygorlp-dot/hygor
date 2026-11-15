import {it,expect} from 'vitest';
import {FILE_COMMAND as C,applyFileCommand} from './commands.js';
import {cabinetFileAccess} from './access.js';
import {documentTrashReferences} from './trash.js';
const now='2026-11-15T15:00:00Z',operationId='local-trash-operation-001';
const fixture=()=>({obras:[{id:'a'}],despesas:[{id:'cost',valor:40}],movEstoque:[{id:'stock',quantidade:4}],workFileCabinets:[{obraId:'a',version:2,folders:[{id:'p',parentId:'',access:{restricted:true,readers:['editor','reader'],editors:['editor']}}],documents:[{id:'doc',name:'Projeto.pdf',folderId:'p',revisions:[{id:'r1',kind:'file',driveId:'drive',itemId:'one',url:'/api/microsoft/onedrive?action=file&driveId=drive&itemId=one'},{id:'r2',kind:'file',driveId:'drive',itemId:'two'},{id:'r3',kind:'link',url:'https://example.org/project'}]},{id:'other',name:'Outro',folderId:'',revisions:[]}],history:[{id:'old',detail:'Histórico anterior',folderIds:['p']}]}]});
const command=(type,version=2)=>({type,expectedVersion:version,idempotencyKey:`${operationId}-${type}`,actorId:'editor',actorRole:'engenheiro',payload:{obraId:'a',id:'doc',operationId}});
it('solicita e conclui com recibo, preservando revisões, permissões, histórico e todos os outros fatos',()=>{
 const data=fixture(),initial=structuredClone(data);const requested=applyFileCommand(data,command(C.DOCUMENT_TRASH_REQUESTED),now);expect(requested.ok).toBe(true);expect(data).toEqual(initial);
 const cabinet=requested.data.workFileCabinets[0],doc=cabinet.documents[0];expect(cabinet.version).toBe(3);expect(doc.trash.operationId).toBe(operationId);expect(doc.deletedAt).toBeUndefined();
 const complete=command(C.DOCUMENT_TRASH_COMPLETED,3);complete.fileTrashProof={kind:'work-file-trash-v1',obraId:'a',documentId:'doc',operationId,actorId:'editor',references:documentTrashReferences(doc),expiresAt:'2026-11-16T15:00:00Z'};
 const result=applyFileCommand(requested.data,complete,now);expect(result.ok).toBe(true);const final=result.data.workFileCabinets[0];expect(final.documents[0].deletedAt).toBe(now);expect(final.documents[0].revisions).toEqual(initial.workFileCabinets[0].documents[0].revisions);expect(final.documents[1]).toEqual(initial.workFileCabinets[0].documents[1]);expect(final.folders).toEqual(initial.workFileCabinets[0].folders);expect(final.history[0]).toEqual(initial.workFileCabinets[0].history[0]);expect(final.history).toHaveLength(3);expect(result.data.despesas).toEqual(initial.despesas);expect(result.data.movEstoque).toEqual(initial.movEstoque);
 const {workFileCabinets:_before,...beforeBusiness}=initial,{workFileCabinets:_after,...afterBusiness}=result.data;expect(afterBusiness).toEqual(beforeBusiness);
 expect(applyFileCommand(result.data,complete,now)).toMatchObject({ok:true,idempotent:true});expect(cabinetFileAccess(result.data,{id:'editor',role:'engenheiro'},{driveId:'drive',itemId:'one'})).toEqual({registered:true,allowed:false});
});
it('recusa leitor, conflito de versão, origem de módulo, identificação ausente e revisão sem referência segura',()=>{
 const base=fixture(),request=command(C.DOCUMENT_TRASH_REQUESTED);
 for(const cmd of [{...request,actorId:'reader'},{...request,expectedVersion:1},{...request,payload:{...request.payload,id:'license:module'}},{...request,payload:{...request.payload,operationId:''}}])expect(applyFileCommand(base,cmd,now).ok).toBe(false);
 base.workFileCabinets[0].documents[0].revisions=[{kind:'file',url:'https://example.org/legacy'}];expect(applyFileCommand(base,request,now).ok).toBe(false);
});
it('mantém pendência retomável e bloqueia edição e conclusão sem comprovante íntegro',()=>{
 const requested=applyFileCommand(fixture(),command(C.DOCUMENT_TRASH_REQUESTED),now).data;
 for(const type of [C.DOCUMENT_MOVED,C.REVISION_ADDED,C.DOCUMENT_TRASH_COMPLETED])expect(applyFileCommand(requested,command(type,3),now).ok).toBe(false);
 const request=command(C.DOCUMENT_TRASH_REQUESTED,3);request.idempotencyKey='different-request-key';expect(applyFileCommand(requested,request,now)).toMatchObject({ok:true,idempotent:true});
 const proof={kind:'work-file-trash-v1',obraId:'a',documentId:'doc',operationId,actorId:'editor',references:documentTrashReferences(requested.workFileCabinets[0].documents[0]),expiresAt:'2026-11-16T15:00:00Z'};
 for(const altered of [{...proof,actorId:'reader'},{...proof,operationId:'another'},{...proof,references:[]},{...proof,expiresAt:'2026-11-14T15:00:00Z'}])expect(applyFileCommand(requested,{...command(C.DOCUMENT_TRASH_COMPLETED,3),fileTrashProof:altered},now).ok).toBe(false);
});
it('deduplica referências e reaproveita IDs de URLs protegidas antigas',()=>{expect(documentTrashReferences({revisions:[{kind:'file',driveId:'d',itemId:'i'},{kind:'file',url:'/api/microsoft/onedrive?action=file&driveId=d&itemId=i'}]})).toEqual([{driveId:'d',itemId:'i'}]);});
it('não envia links externos para a lixeira nem interpreta seus parâmetros como posse de arquivo',()=>{expect(documentTrashReferences({revisions:[{kind:'link',url:'https://example.org/api/microsoft/onedrive?driveId=d&itemId=i'},{kind:'link',driveId:'d',itemId:'i'}]})).toEqual([]);expect(()=>documentTrashReferences({revisions:[{kind:'file',url:'https://example.org/api/microsoft/onedrive?driveId=d&itemId=i'}]})).toThrow('identificação segura');});

it('protege documentos preservados nas revisões de contrato comercial',()=>{const data=fixture();data.commercialContractRecords=[{obraId:'a',anexos:[],revisions:[{anexos:[{documentId:'doc',revisionId:'r1'}]}]}];expect(applyFileCommand(data,command(C.DOCUMENT_TRASH_REQUESTED),now)).toMatchObject({ok:false});});
