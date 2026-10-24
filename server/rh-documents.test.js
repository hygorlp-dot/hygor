import {describe,it,expect,vi} from 'vitest';
import {handleRhDocuments,RH_BUCKET} from './rh-documents.js';
const uuid='00000000-0000-4000-8000-000000000001';
function fixture(){
  const store=new Map([['arced_ponto_v1',{value:{employees:[{id:'e'},{id:'e2'}]}}]]);
  const storage={getBucket:vi.fn(async()=>({data:{public:false}})),upload:vi.fn(async()=>({})),createSignedUrl:vi.fn(async()=>({data:{signedUrl:'https://private.test/temporary'}})),remove:vi.fn(async()=>({}))};
  const db={storage:{getBucket:storage.getBucket,from:()=>storage},from:()=>{
    const filters={};let op='read',payload;
    const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},like:(_,v)=>{filters.prefix=v.slice(0,-1).replace(/\\([_%\\])/g,'$1');return q;},order:()=>q,limit:()=>q,maybeSingle:async()=>({data:store.get(filters.key)||null}),insert:v=>{store.set(v.key,v);return Promise.resolve({});},update:v=>{op='update';payload=v;return q;},then:resolve=>{let data=[...store.entries()].filter(([k])=>!filters.prefix||k.startsWith(filters.prefix)).map(([key,row])=>({key,...row}));if(op==='update'){const row=store.get(filters.key);if(row?.updated_at===filters.updated_at){store.set(filters.key,{...row,...payload});data=[{key:filters.key}];}else data=[];}return Promise.resolve(resolve({data}));}};return q;
  }};
  const invoke=body=>handleRhDocuments({db,user:{id:'rh',nome:'RH',role:'rh'},body:{employeeId:'e',documentId:uuid,...body},company:'arcd',now:'2026-10-24T12:00:00Z'});
  return {db,store,storage,invoke};
}
const upload={documentAction:'upload',dataUrl:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4\nQA').toString('base64'),fileName:'contrato.pdf',category:'contract'};
describe('prontuário privado RH',()=>{
  it('nega usuário sem papel RH antes de consultar dados',async()=>{
    const db={from:vi.fn()};const result=await handleRhDocuments({db,user:{role:'financeiro'},body:{},company:'arcd'});expect(result.status).toBe(403);expect(db.from).not.toHaveBeenCalled();
  });
  it('grava arquivo privado, integridade e autor; repetição é idempotente',async()=>{
    const f=fixture(),result=await f.invoke(upload);expect(result.status).toBe(200);expect(result.body.document).toMatchObject({createdBy:'rh',category:'contract',employeeId:'e'});expect(result.body.document.sha256).toHaveLength(64);await f.invoke(upload);expect(f.storage.upload).toHaveBeenCalledTimes(1);expect(f.storage.upload.mock.calls[0][0]).toContain('arcd/ZQ/');
    const listed=await f.invoke({documentAction:'list'});expect(listed.body.documents).toHaveLength(1);expect(JSON.stringify(listed.body)).not.toContain('signedUrl');
  });
  it('nega documento de outro funcionário e assina por só 60 segundos',async()=>{
    const f=fixture();await f.invoke(upload);expect((await f.invoke({employeeId:'e2',documentAction:'open'})).status).toBe(404);
    expect((await f.invoke({documentAction:'open'})).status).toBe(200);expect(f.storage.createSignedUrl.mock.calls[0][1]).toBe(60);
  });
  it('falha fechado se o bucket for público e nunca gera URL pública',async()=>{
    const f=fixture();f.storage.getBucket.mockResolvedValue({data:{public:true}});expect((await f.invoke(upload)).status).toBe(503);expect(f.storage.upload).not.toHaveBeenCalled();expect(RH_BUCKET).toBe('rh-prontuarios');
  });
  it('rejeita extensão/MIME adulterados, categoria e arquivo grande',async()=>{
    const f=fixture();expect((await f.invoke({...upload,dataUrl:'data:application/pdf;base64,'+Buffer.from('<script>bad</script>').toString('base64')})).status).toBe(400);
    expect((await f.invoke({...upload,category:'bad'})).status).toBe(400);
    expect((await f.invoke({...upload,dataUrl:'data:application/pdf;base64,'+Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(3*1024*1024)]).toString('base64')})).status).toBe(413);
  });
  it('arquiva com motivo preservando arquivo e autoria',async()=>{
    const f=fixture();await f.invoke(upload);expect((await f.invoke({documentAction:'archive',reason:'x'})).status).toBe(400);
    const result=await f.invoke({documentAction:'archive',reason:'Substituído por novo contrato'});expect(result.status).toBe(200);expect(result.body.document).toMatchObject({archivedBy:'rh',createdBy:'rh'});expect(f.storage.remove).not.toHaveBeenCalled();
  });
});
