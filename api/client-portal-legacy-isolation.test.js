// @vitest-environment node
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {portalFixture} from '../server/client-portal.fixture.js';
const state=vi.hoisted(()=>({rows:[],writes:0}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({from(table){
 if(table!=='company_app_data')throw new Error('Tabela fora da auditoria legada.');
 const filters=[],q={select(){return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},in(k,values){filters.push(row=>values.includes(row[k]));return q;},like(k,pattern){const prefix=pattern.replace(/%$/,'');filters.push(row=>String(row[k]).startsWith(prefix));return q;},order(){return q;},range(){return q;},maybeSingle:async()=>({data:state.rows.filter(row=>filters.every(fn=>fn(row)))[0]||null,error:null}),then(resolve,reject){return Promise.resolve({data:state.rows.filter(row=>filters.every(fn=>fn(row))),error:null}).then(resolve,reject);}};
 for(const method of ['update','insert','upsert','delete'])q[method]=()=>{state.writes++;throw new Error('Gravação local não esperada.');};return q;
 },rpc(){state.writes++;throw new Error('RPC não permitida na auditoria legada.');}})}));
let handler;
beforeAll(async()=>{
 vi.stubEnv('SUPABASE_URL','https://audit.invalid');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','audit-local-only');vi.stubEnv('COMPANY_ID','arcd');
 if(process.env.B204_AUDIT_SNAPSHOT)state.rows=JSON.parse(readFileSync(process.env.B204_AUDIT_SNAPSHOT,'utf8')).sourceRows.map(row=>({...row,company_id:'arcd'}));
 else{const data=portalFixture();data.obras[0].portalCliente.token='token-local-b204';data.obras.push({id:'foreign',name:'Outra obra',portalCliente:{ativo:true,token:'token-local-foreign'}});state.rows=[{key:'arced_ponto_v1',company_id:'arcd',value:data,updated_at:'2026-11-15T12:00:00Z'}];}
 ({default:handler}=await import('./data.js'));
},30000);
afterAll(()=>vi.unstubAllEnvs());
const call=async body=>{const res={code:200,body:null,headers:{},status(code){this.code=code;return this;},setHeader(key,value){this.headers[key]=value;},json(body){this.body=body;return this;}};await handler({method:'POST',headers:{},body:{action:'client-portal',...body}},res);return res;};
it('o link antigo usa o token da obra exata e recusa IDs trocados ou token ausente',async()=>{
 const {decodeAppData}=await import('../server/data-codec.js');const source=decodeAppData(state.rows.find(row=>row.key==='arced_ponto_v1').value);
 const work=source.obras.find(row=>row.id===(process.env.B204_AUDIT_SNAPSHOT?'kep278px87cr':'obra-local'));
 const token=work.portalCliente.token;expect(token).toBeTruthy();
 const own=await call({obraId:work.id,token});expect(own.code).toBe(200);expect(own.body.portal.obra.id).toBe(work.id);
 for(const other of source.obras.filter(row=>row.id!==work.id))expect((await call({obraId:other.id,token})).code).toBe(404);
 expect((await call({obraId:work.id})).code).toBe(404);expect((await call({obraId:work.id,token:'invalid'})).code).toBe(404);
 expect(state.writes).toBe(0);
},30000);
