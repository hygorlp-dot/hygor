// @vitest-environment node
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {cutoverHash} from './company-cutover.js';
import {CUTOVER_EVIDENCE_CHECKS} from './company-cutover-approval.js';
import {preparePreservingCompanyCutover} from './company-cutover-preservation.js';
import {companyCutoverSql,approvedCompanyCutoverSql} from './company-cutover-sql.js';
import {prepareCompanyCutoverStages} from '../scripts/lib/company-cutover-staging.mjs';
import {newCutoverRehearsal} from '../scripts/lib/company-cutover-rehearsal.mjs';
const up=readFileSync('migrations/023_company_cutover_private_journal.up.sql','utf8'),down=readFileSync('migrations/023_company_cutover_private_journal.down.sql','utf8');
function fixture({large=false}={}){
 const before={core_projects:[{company_id:'arcd',id:'k',payload:{name:"K1-10 · João ' Obra 🚧",note:large?'á🚧'.repeat(20000):'sem alteração financeira'}}],company_app_data:[{company_id:'arcd',key:'onedrive_auth_v1',value:{sealed:'synthetic-live-session'}}],auth_rate_limits:[{id:'attempt',value:{attempts:8}}],ponto_arp_registros:[{id:'nsr-1',value:{nsr:1}}]};
 const after=structuredClone(before);after.core_projects[0].company_id='mrc';after.company_app_data=[];after.auth_rate_limits=[];
 const content={kind:'company-cutover-offline',localOnly:true,activationReady:false,before,after,external:{},order:['auth_rate_limits','company_app_data','core_projects'],primaryKeys:{core_projects:['company_id','id'],company_app_data:['company_id','key'],auth_rate_limits:['id'],ponto_arp_registros:['id']},companyScopedTables:['core_projects','company_app_data'],relations:[]};
 const original={...content,id:cutoverHash(content)},bundle=preparePreservingCompanyCutover({bundle:original,capture:before});
 const now=Date.now(),approval={version:1,action:'apply-company-separation-once',packageId:bundle.id,targetHash:cutoverHash(bundle.after),releaseCommit:'b'.repeat(40),capturedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+14*60*1000).toISOString(),checks:Object.fromEntries(CUTOVER_EVIDENCE_CHECKS.map(key=>[key,{status:'verified',evidenceSha256:'a'.repeat(64)}]))};
 return {original,bundle,approval,stages:prepareCompanyCutoverStages(bundle,approval)};
}
const prepared=async input=>{const db=await newCutoverRehearsal(input.original);await db.exec(up);return db;};
const stage=async(db,s)=>{await db.exec(s.registration);for(const part of s.fragments)await db.exec(part);};
const projectCompany=async db=>(await db.query("select company_id from core_projects where id='k'")).rows[0].company_id;

it('migration idempotente não muda obra e nega o diário e os fragmentos aos clientes e service_role',async()=>{
 const input=fixture(),db=await prepared(input);
 try{
  await db.exec(up);expect(await projectCompany(db)).toBe('arcd');
  for(const role of ['anon','authenticated','service_role']){
   expect((await db.query("select has_schema_privilege($1,'company_cutover_private','usage') allowed",[role])).rows[0].allowed).toBe(false);
   for(const table of ['runs','staged_runs','staged_parts'])expect((await db.query("select has_table_privilege($1,$2,'select,insert,update,delete') allowed",[role,'company_cutover_private.'+table])).rows[0].allowed).toBe(false);
  }
  expect((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")).rows[0].n).toBe(0);
  await db.exec(down);await db.exec(down);await db.exec(up);
 }finally{await db.close();}
});
it('o compilador real exige cada evidência, commit, alvo e corte atual; o rascunho continua fechado',()=>{
 const {bundle,approval}=fixture();expect(companyCutoverSql(bundle)).toContain('Pacote somente local');
 for(const key of CUTOVER_EVIDENCE_CHECKS){const incomplete=structuredClone(approval);delete incomplete.checks[key];expect(()=>prepareCompanyCutoverStages(bundle,incomplete)).toThrow(`Evidência de implantação ausente: ${key}`);}
 expect(()=>prepareCompanyCutoverStages(bundle,{...approval,releaseCommit:''})).toThrow('Commit');
 expect(()=>prepareCompanyCutoverStages(bundle,{...approval,targetHash:'c'.repeat(64)})).toThrow('alvo');
 expect(()=>prepareCompanyCutoverStages(bundle,{...approval,expiresAt:new Date(Date.now()-1).toISOString()})).toThrow('expirado');
});
it('o SQL bruto carrega seu prazo e não pode ser aplicado depois de vencer',async()=>{
 const input=fixture(),db=await newCutoverRehearsal(input.original),past=Date.now()-120000;
 try{
  const approval={...input.approval,capturedAt:new Date(past-1000).toISOString(),expiresAt:new Date(past+1000).toISOString()};
  const sql=approvedCompanyCutoverSql(input.bundle,approval,{now:past});await expect(db.exec(sql)).rejects.toThrow('Corte expirado');await db.exec('rollback');
  expect(await projectCompany(db)).toBe('arcd');
 }finally{await db.close();}
});
it('nova aprovação do mesmo pacote cria tentativa distinta e preserva a tentativa expirada',async()=>{
 const input=fixture(),db=await prepared(input);
 try{
  await db.exec(input.stages.registration);await db.query("update company_cutover_private.staged_runs set expires_at=now()-interval '1 minute' where id=$1",[input.stages.id]);
  const next=prepareCompanyCutoverStages(input.bundle,{...input.approval,capturedAt:new Date(Date.now()-100).toISOString(),expiresAt:new Date(Date.now()+13*60*1000).toISOString()});
  expect(next.id).not.toBe(input.stages.id);expect(next.packageId).toBe(input.stages.packageId);await db.exec(next.registration);
  expect((await db.query('select count(*)::int n from company_cutover_private.staged_runs')).rows[0].n).toBe(2);
  expect(await projectCompany(db)).toBe('arcd');
 }finally{await db.close();}
});
it('reconstitui bytes UTF-8 divididos, aplica uma vez e preserva sessão, limites e NSR',async()=>{
 const input=fixture({large:true}),db=await prepared(input),s=input.stages;
 try{
  expect(s.fragments.length).toBeGreaterThan(1);expect(Math.max(...s.fragments.map(x=>Buffer.byteLength(x)))).toBeLessThan(1000000);
  await stage(db,s);await stage(db,s);await db.exec(s.apply);expect(await projectCompany(db)).toBe('mrc');
  expect((await db.query("select payload from core_projects where id='k'")).rows[0].payload).toEqual(input.original.before.core_projects[0].payload);
  expect((await db.query('select * from auth_rate_limits')).rows).toEqual(input.original.before.auth_rate_limits);
  expect((await db.query('select * from ponto_arp_registros')).rows).toEqual(input.original.before.ponto_arp_registros);
  expect((await db.query("select value from company_app_data where key='onedrive_auth_v1'")).rows[0].value.sealed).toBe('synthetic-live-session');
  await db.exec("update core_projects set payload='{\"postCutover\":true}' where id='k'");await db.exec(s.apply);
  expect((await db.query("select payload from core_projects where id='k'")).rows[0].payload).toEqual({postCutover:true});
  expect((await db.query('select count(*)::int n from company_cutover_private.runs')).rows[0].n).toBe(1);
  await expect(db.exec(down)).rejects.toThrow('recibos');
 }finally{await db.close();}
});
it('recusa parte ausente, adulteração e expiração sem aplicar dados parciais',async()=>{
 const input=fixture({large:true}),db=await prepared(input),s=input.stages;
 try{
  await db.exec(s.registration);await db.exec(s.fragments[0]);await expect(db.exec(s.apply)).rejects.toThrow('Carga incompleta');expect(await projectCompany(db)).toBe('arcd');
  for(const part of s.fragments.slice(1))await db.exec(part);
  await db.query("update company_cutover_private.staged_parts set payload=decode('00','hex') where run_id=$1 and ordinal=0",[s.id]);
  await expect(db.exec(s.apply)).rejects.toThrow('Carga incompleta');expect(await projectCompany(db)).toBe('arcd');
  await expect(db.exec(s.fragments[0])).rejects.toThrow('Fragmento divergente');
  await db.query('update company_cutover_private.staged_runs set expires_at=now()-interval \'1 minute\' where id=$1',[s.id]);await expect(db.exec(s.apply)).rejects.toThrow('Corte expirado');
  expect((await db.query('select applied_at from company_cutover_private.staged_runs')).rows[0].applied_at).toBeNull();
 }finally{await db.close();}
});
it('a aplicação confere a origem travada e reverte o recibo junto com os dados em caso de falha',async()=>{
 const input=fixture(),db=await prepared(input),s=input.stages;
 try{
  await stage(db,s);await db.exec("update core_projects set payload='{\"concurrent\":true}' where id='k'");
  await expect(db.exec(s.apply)).rejects.toThrow('Estado divergente');expect(await projectCompany(db)).toBe('arcd');expect((await db.query('select count(*)::int n from company_cutover_private.runs')).rows[0].n).toBe(0);
  await db.query("update core_projects set payload=$1::jsonb where id='k'",[JSON.stringify(input.original.before.core_projects[0].payload)]);
  await db.exec("create function fail_cutover() returns trigger language plpgsql as $$ begin raise exception 'synthetic-failure'; end $$; create trigger fail_cutover before insert on core_projects for each row execute function fail_cutover();");
  await expect(db.exec(s.apply)).rejects.toThrow('synthetic-failure');expect(await projectCompany(db)).toBe('arcd');expect((await db.query('select applied_at from company_cutover_private.staged_runs')).rows[0].applied_at).toBeNull();expect((await db.query('select count(*)::int n from company_cutover_private.runs')).rows[0].n).toBe(0);
 }finally{await db.close();}
});
