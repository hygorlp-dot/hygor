// @vitest-environment node
import {it,expect,vi} from 'vitest';
vi.hoisted(()=>{process.env.MICROSOFT_CLIENT_SECRET='local-batch-trash-test-only';});
import {trashDocumentBatch,deletionBlock} from './batch-trash.js';
import {applyFileCommand} from './commands.js';
import {trashWorkDocument,verifiedFileTrashCommand} from '../../../server/work-file-trash.js';

const user={id:'editor',nome:'Editor',role:'engenheiro',obraId:'a',active:true,accessTabs:['arquivos']};
const initial=()=>({obras:[{id:'a',oneDriveDriveId:'drive',oneDriveFolderId:'root'}],despesas:[{valor:42}],movEstoque:[{quantidade:2}],workFileCabinets:[{obraId:'a',version:1,folders:[{id:'p',parentId:'',access:{restricted:true,readers:['editor','reader'],editors:['editor']}}],documents:['one','two','old'].map(id=>({id,name:id,folderId:'p',revisions:[1,2].map(n=>({id:`${id}-${n}`,kind:'file',driveId:'drive',itemId:`${id}-${n}`}))})),history:[{id:'old-history',detail:'Preservar',folderIds:['p']}]}]});
function setup(){
 let state=initial();const removed=new Set(),proofs=new Map();
 const dispatchCommand=vi.fn(async command=>{const result=applyFileCommand(state,verifiedFileTrashCommand({...command,now:new Date().toISOString()}),new Date().toISOString());if(result.ok)state=result.data;return result;});
 const graph=async(_token,path,options={})=>{const id=path.split('/items/')[1].split('?')[0];if(removed.has(id))throw Object.assign(new Error('Ausente'),{status:404});if(options.method==='DELETE'){removed.add(id);return {status:204};}return {json:async()=>({id,file:{},eTag:id,parentReference:{id:'root'}})};};
 const recycle=vi.fn(async body=>{const response=await trashWorkDocument({data:state,user,body,getToken:async()=>'local-only',graph});proofs.set(body.id,response.receipt);return response;});
 return {get state(){return state;},removed,dispatchCommand,recycle,proofs};
}
it('exclui todas as revisões, com versões sequenciais, sem alterar documentos anteriores, permissões ou fatos financeiros',async()=>{
 const env=setup(),before=structuredClone(env.state),documents=env.state.workFileCabinets[0].documents.slice(0,2);
 const results=await trashDocumentBatch({data:env.state,obraId:'a',documents,user,...env,attempts:new Map()});
 expect(results.every(item=>item.ok)).toBe(true);expect(env.removed.size).toBe(4);
 const cabinet=env.state.workFileCabinets[0];expect(cabinet.documents.slice(0,2).every(item=>item.deletedAt)).toBe(true);expect(cabinet.documents[2]).toEqual(before.workFileCabinets[0].documents[2]);expect(cabinet.folders).toEqual(before.workFileCabinets[0].folders);expect(cabinet.history[0]).toEqual(before.workFileCabinets[0].history[0]);expect(cabinet.history).toHaveLength(5);
 expect(env.dispatchCommand.mock.calls.map(([c])=>c.expectedVersion)).toEqual([1,2,3,4]);expect(env.state.despesas).toEqual(before.despesas);expect(env.state.movEstoque).toEqual(before.movEstoque);
});
it('resposta perdida conserva pendência, conclui os demais e retoma sem duplicar revisões ou histórico',async()=>{
 const env=setup(),documents=env.state.workFileCabinets[0].documents.slice(0,2),attempts=new Map(),recycle=async body=>{const r=await env.recycle(body);if(body.id==='one'&&env.recycle.mock.calls.length===1)throw new Error('Resposta perdida');return r;};
 const first=await trashDocumentBatch({data:env.state,obraId:'a',documents,user,...env,recycle,attempts});
 expect(first.map(item=>item.ok)).toEqual([false,true]);expect(env.removed.size).toBe(4);
 const retry=await trashDocumentBatch({data:env.state,obraId:'a',documents:documents.filter(d=>!first.find(r=>r.id===d.id).ok),user,...env,attempts});
 expect(retry[0].ok).toBe(true);expect(env.removed.size).toBe(4);expect(env.state.workFileCabinets[0].history).toHaveLength(5);expect(env.state.workFileCabinets[0].documents[0].revisions).toEqual(documents[0].revisions);
});
it('bloqueia leitor, outro papel/obra, inativo, origem de módulo, contrato e revisão sem referência antes do OneDrive',()=>{
 const data=initial(),cabinet=data.workFileCabinets[0],document=cabinet.documents[0];
 for(const u of [{...user,id:'reader'},{...user,role:'cliente'},{...user,obraId:'b'},{...user,active:false}])expect(deletionBlock(data,cabinet,document,u)).toBeTruthy();
 expect(deletionBlock(data,cabinet,{...document,readOnly:true},user)).toContain('origem');
 data.commercialContractRecords=[{obraId:'a',anexos:[{documentId:document.id}]}];expect(deletionBlock(data,cabinet,document,user)).toContain('contrato');delete data.commercialContractRecords;
 expect(deletionBlock(data,cabinet,{...document,revisions:[{kind:'file'}]},user)).toContain('identificação');
});
it('não exclui revisão alterada depois da confirmação, nem finaliza com recibo de outro documento',async()=>{
 const env=setup(),documents=structuredClone(env.state.workFileCabinets[0].documents.slice(0,2));documents[0].revisions.pop();
 let results=await trashDocumentBatch({data:env.state,obraId:'a',documents:documents.slice(0,1),user,...env,attempts:new Map()});expect(results[0].error).toContain('mudou');expect(env.recycle).not.toHaveBeenCalled();
 await trashDocumentBatch({data:env.state,obraId:'a',documents:[documents[1]],user,...env,attempts:new Map()});
 results=await trashDocumentBatch({data:env.state,obraId:'a',documents:[env.state.workFileCabinets[0].documents[0]],user,...env,recycle:async()=>({ok:true,receipt:env.proofs.get('two')}),attempts:new Map()});expect(results[0].ok).toBe(false);expect(env.state.workFileCabinets[0].documents[0].deletedAt).toBeUndefined();
});
