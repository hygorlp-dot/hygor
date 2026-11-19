// @vitest-environment node
import {it,expect} from 'vitest';
import {cutoverHash} from './company-cutover.js';
import {preparePreservingCompanyCutover} from './company-cutover-preservation.js';
import {companyCutoverSql} from './company-cutover-sql.js';
import {newCutoverRehearsal,executeCutoverRehearsal} from '../scripts/lib/company-cutover-rehearsal.mjs';

const pin=content=>({...content,id:cutoverHash(content)});
function fixture(){
 const before={company_app_data:[{company_id:'arcd',key:'arced_ponto_v1',value:{obras:[{id:'k'},{id:'a'}]}},{company_id:'arcd',key:'onedrive_auth_v1',value:{sealed:'synthetic-old-encrypted-session'}},{company_id:'arcd',key:'arced_presence__old',value:{seen:'old'}}],auth_rate_limits:[{id:'attempt',value:{count:2}}],ponto_arp_registros:[{id:'nsr-1',value:{nsr:1,hash:'synthetic-chain'}}],core_projects:[{company_id:'arcd',id:'k',payload:{name:'K1-10'}},{company_id:'arcd',id:'a',payload:{name:'A'}}]};
 const after=structuredClone(before);after.company_app_data=[{company_id:'arcd',key:'arced_ponto_v1',value:{obras:[{id:'a'}]}},{company_id:'mrc',key:'arced_ponto_v1',value:{obras:[{id:'k'}]}}];after.core_projects[0].company_id='mrc';after.auth_rate_limits=[];
 return pin({version:1,kind:'company-cutover-offline',localOnly:true,activationReady:false,before,after,external:{},order:['auth_rate_limits','company_app_data','core_projects'],primaryKeys:{company_app_data:['company_id','key'],auth_rate_limits:['id'],ponto_arp_registros:['id'],core_projects:['company_id','id']},companyScopedTables:['company_app_data','core_projects'],relations:[]});
}
const refresh=bundle=>{const capture=structuredClone(bundle.before);capture.company_app_data=capture.company_app_data.filter(row=>!row.key.startsWith('arced_presence__'));capture.company_app_data.find(row=>row.key==='onedrive_auth_v1').value={sealed:'synthetic-renewed-encrypted-session'};capture.company_app_data.push({company_id:'arcd',key:'arced_presence__new',value:{seen:'now'}});capture.auth_rate_limits[0].value.count=9;capture.ponto_arp_registros.push({id:'nsr-2',value:{nsr:2,hash:'synthetic-next'}});return capture;};

it('preserva controles atuais sem incluí-los no SQL, comparação ou diário privado',()=>{
 const original=fixture(),capture=refresh(original),copy=structuredClone(capture),plan=preparePreservingCompanyCutover({bundle:original,capture});
 expect(capture).toEqual(copy);expect(plan.order).toEqual(['company_app_data','core_projects']);expect(plan.parentBundleId).toBe(original.id);
 expect(plan.before.auth_rate_limits).toEqual([]);expect(plan.before.ponto_arp_registros).toEqual([]);
 expect(plan.before.company_app_data.map(row=>row.key)).toEqual(['arced_ponto_v1']);expect(plan.after.company_app_data).toHaveLength(2);
 const sql=companyCutoverSql(plan,{rehearsal:true});expect(sql).not.toContain('synthetic-old-encrypted-session');expect(sql).not.toContain('synthetic-renewed-encrypted-session');expect(sql).not.toContain('synthetic-chain');expect(sql).toContain("left(key,16) <> 'arced_presence__'");
 expect(companyCutoverSql(plan)).toContain('Pacote somente local');expect(plan.activationReady).toBe(false);
});
it('recusa concorrência operacional e alterações na ARP, inclusive pelo compilador antigo',()=>{
 const bundle=fixture(),capture=refresh(bundle);capture.core_projects[0].payload.name='Mudança real';
 expect(()=>preparePreservingCompanyCutover({bundle,capture})).toThrow('Origem operacional mudou');
 const changed=fixture();changed.after.ponto_arp_registros=[];const {id:_id,...content}=changed;const repinned=pin(content);
 expect(()=>preparePreservingCompanyCutover({bundle:repinned,capture:refresh(changed)})).toThrow('Alteração protegida');
 expect(()=>companyCutoverSql(repinned,{rehearsal:true})).toThrow('Alteração protegida');
});
it('não permite ampliar a lista de exceções nem usar a imagem parcial como recuperação',()=>{
 const bundle=fixture(),plan=preparePreservingCompanyCutover({bundle,capture:refresh(bundle)});
 expect(()=>companyCutoverSql(plan,{rehearsal:true,recovery:true})).toThrow('pacote integral');
 const {id:_id,...content}=structuredClone(plan);content.preservation.tables.push('core_projects');expect(()=>companyCutoverSql(pin(content),{rehearsal:true})).toThrow('Escopo de preservação divergente');
});
it('SQL real aplica e repete sem reverter sessões, presença, tentativas ou NSR recentes',async()=>{
 const original=fixture(),capture=refresh(original),plan=preparePreservingCompanyCutover({bundle:original,capture});
 const db=await newCutoverRehearsal(original);
 try{
  await db.query("update company_app_data set value=$1::jsonb where key='onedrive_auth_v1'",[JSON.stringify({sealed:'synthetic-live-session'})]);
  await db.exec("delete from company_app_data where key='arced_presence__old'; insert into company_app_data values ('arcd','arced_presence__live','{\"seen\":\"live\"}'); update auth_rate_limits set value='{\"count\":20}'; insert into ponto_arp_registros values ('nsr-3','{\"nsr\":3}');");
  const controls=async()=>({sessions:(await db.query("select * from company_app_data where key='onedrive_auth_v1' or left(key,16)='arced_presence__' order by key")).rows,limits:(await db.query('select * from auth_rate_limits')).rows,arp:(await db.query('select * from ponto_arp_registros order by id')).rows});
  const before=await controls();
  await executeCutoverRehearsal(db,plan);expect(await controls()).toEqual(before);
  expect((await db.query("select company_id from core_projects where id='k'")).rows[0].company_id).toBe('mrc');
  await db.exec("update auth_rate_limits set value='{\"count\":21}'");const updated=await controls();await executeCutoverRehearsal(db,plan);expect(await controls()).toEqual(updated);
  const journal=(await db.query('select before_image,clean_image from company_cutover_private.runs')).rows;
  expect(JSON.stringify(journal)).not.toContain('synthetic-live-session');expect(JSON.stringify(journal)).not.toContain('arced_presence__live');
 }finally{await db.close();}
});
it('recusa escrita nova na origem no momento da transação e faz rollback integral',async()=>{
 const original=fixture(),plan=preparePreservingCompanyCutover({bundle:original,capture:refresh(original)}),db=await newCutoverRehearsal(original);
 try{
  await db.exec("update core_projects set payload='{\"name\":\"novo\"}' where id='a'");
  await expect(executeCutoverRehearsal(db,plan)).rejects.toThrow('Estado divergente');
  expect((await db.query("select company_id from core_projects where id='k'")).rows[0].company_id).toBe('arcd');
  expect((await db.query("select to_regclass('company_cutover_private.runs') journal")).rows[0].journal).toBeNull();
 }finally{await db.close();}
});
