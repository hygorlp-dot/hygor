import {it,expect} from 'vitest';
import {applyFileCommand,FILE_COMMAND as C} from './commands.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {validateFileCabinetScope} from '../../../server/work-file-cabinet-policy.js';
import {validateBatch,droppedFiles} from './file-drop.js';
const now='2026-11-15T12:00:00Z',user={id:'eng',role:'engenheiro',obraId:'a',active:true,accessTabs:['arquivos']};
const data=()=>({obras:[{id:'a'},{id:'b'}],despesas:[{id:'cost',valor:10}],movEstoque:[{id:'stock',quantidade:1}],workFileCabinets:[{obraId:'a',version:2,folders:[{id:'p',name:'Projetos',parentId:''}],documents:[{id:'old',name:'a.pdf',folderId:'p',revisions:[{id:'r-old',label:'R01',url:'https://example.org/old'}]}],history:[]}]});
const doc=id=>({id,revisionId:`rev-${id}`,name:`${id}.pdf`,label:'R01',kind:'file',fileName:`${id}.pdf`,size:10,url:`https://example.org/${id}`});
const cmd=()=>({type:C.DOCUMENTS_ADDED,expectedVersion:2,idempotencyKey:'batch-operation-1',actorId:'eng',actorRole:'engenheiro',now,payload:{obraId:'a',folderId:'p',documents:[doc('a'),doc('b')]}});
it('grava lote inteiro em uma versão, preserva documentos e não gera custo, estoque ou pagamento',()=>{
 const before=data(),original=structuredClone(before),command=cmd();const r=applyOperationalCommand(before,command);expect(r.reason).toBeUndefined();expect(r.ok).toBe(true);
 const cabinet=r.data.workFileCabinets[0];expect(cabinet.version).toBe(3);expect(cabinet.documents).toHaveLength(3);expect(cabinet.documents[0]).toEqual(original.workFileCabinets[0].documents[0]);expect(cabinet.history).toHaveLength(1);
 const {workFileCabinets,operationalCommandReceipts,...rest}=r.data;const {workFileCabinets:originalCabinets,...originalRest}=original;expect(originalCabinets).toHaveLength(1);expect(rest).toEqual(originalRest);expect(operationalCommandReceipts).toHaveLength(1);expect(before).toEqual(original);
 expect(applyOperationalCommand(r.data,command).data.workFileCabinets).toEqual(workFileCabinets);
});
it('falha em um documento não grava parte do lote',()=>{const before=data(),original=structuredClone(before),command=cmd();command.payload.documents[1].fileName='bad.exe';expect(applyFileCommand(before,command,now).ok).toBe(false);expect(before).toEqual(original);});
it('bloqueia versão antiga, IDs existentes/repetidos e lote vazio ou grande',()=>{
 for(const mutate of [c=>c.expectedVersion=1,c=>c.payload.documents[1].id='old',c=>c.payload.documents[1].id='a',c=>c.payload.documents=[],c=>c.payload.documents=Array.from({length:21},(_,i)=>doc(String(i)))]){const c=cmd();mutate(c);expect(applyFileCommand(data(),c,now).ok).toBe(false);}
});
it('não permite desviar documentos do lote para outra obra ou pasta',()=>{const c=cmd();c.payload.documents[0].obraId='b';c.payload.documents[0].folderId='foreign';const r=applyFileCommand(data(),c,now);expect(r.ok).toBe(true);expect(r.data.workFileCabinets[0].documents.every(d=>d.folderId==='p')).toBe(true);});
it('valida permissões do lote na API e no comando',()=>{const before=data();before.workFileCabinets[0].folders[0].access={restricted:true,readers:['eng'],editors:[]};expect(validateFileCabinetScope({user,data:before,command:cmd()}).ok).toBe(false);expect(applyFileCommand(before,cmd(),now).ok).toBe(false);expect(validateFileCabinetScope({user:{...user,obraId:'b'},data:data(),command:cmd()}).ok).toBe(false);});
it('valida todos os arquivos antes do envio',()=>{expect(validateBatch([new File(['a'],'a.pdf'),new File(['b'],'bad.exe')])).toContain('bad.exe');expect(validateBatch(Array.from({length:21},()=>new File(['x'],'a.pdf')))).toContain('20');});

it('recusa pastas, nomes longos e tamanho excedido no lote',()=>{
 expect(droppedFiles({items:[{webkitGetAsEntry:()=>({isDirectory:true})}],files:[]}).error).toContain('não pastas');
 expect(validateBatch([new File(['x'],'a'.repeat(200)+'.pdf')])).toContain('200');
 expect(validateBatch([new File([new Uint8Array(3*1024*1024+1)],'grande.pdf')])).toContain('3 MB');
});
