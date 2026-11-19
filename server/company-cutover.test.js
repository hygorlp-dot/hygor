// @vitest-environment node
import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {prepareCompanyCutover,verifyCutoverBundle,cutoverHash} from './company-cutover.js';
import {planCompanyPartition} from './company-partition.js';
import {companySourceView} from './company-source-view.js';
import {encodeAppData,compactProfiles} from './data-codec.js';
import {companyCutoverSql} from './company-cutover-sql.js';
import {newCutoverRehearsal,executeCutoverRehearsal,readCutoverRehearsal,verifyRehearsalDre} from '../scripts/lib/company-cutover-rehearsal.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const inputs=()=>{
 const data={schemaVersion:1,config:{},usuarios:[{id:'admin',role:'admin',active:true},{id:'eng',role:'engenheiro',active:true,authUserId:'identity'}],obras:[{id:'i',name:'I-8',engineerId:'eng'},{id:'k',name:'K1-10',engineerId:'eng'},{id:'a',name:'ARCD'}],transacoes:[{id:'remove1',valor:4000},{id:'remove2',valor:-980},{id:'remove3',valor:-800}],despesasEmpresa:[{id:'generated',valor:800,competencia:'2026-11'}],payments:[{id:'generated-receipt',valor:4000,data:'2026-11-01'}]};
 const tables={company_app_data:[{company_id:'arcd',key:'arced_ponto_v1',value:data,updated_at:'2026-11-17T12:00:00Z',updated_by:'old-actor'},{company_id:'arcd',key:'arced_auth_profiles_v1',value:compactProfiles(data),updated_at:'2026-11-17T12:00:00Z',updated_by:'old-actor'}],core_projects:data.obras.map(work=>({company_id:'arcd',id:work.id,payload:work})),purchase_requests:[{company_id:'arcd',id:'req-i',project_id:'i',payload:{quantity:1}},{company_id:'arcd',id:'req-a',project_id:'a',payload:{quantity:2,note:"Aspas ' e $migration$ preservados"}}],financial_shadow_runs:[{id:'mixed-history',company_id:'arcd',payload:{mixed:true}}],financial_titles:[],bank_transactions:[],settlements:[],reconciliation_links:[]};
 const snapshot={complete:false,capturedAt:'2026-11-18T12:00:00Z',tables,inventory:Object.keys(tables),companyScopedTables:Object.keys(tables),primaryKeys:Object.fromEntries(Object.keys(tables).map(table=>[table,table==='company_app_data'?['company_id','key']:table==='core_projects'?['company_id','id']:['id']])),foreignKeys:[{name:'request_project',table:'purchase_requests',columns:['company_id','project_id'],references:'core_projects',referenceColumns:['company_id','id']}],externalTables:{}};
 const plan=planCompanyPartition(snapshot,{mrcProjectIds:{'I1-08':'i','K1-10':'k'},unlinkedCompany:'arcd',archiveHistory:true,filesVerified:false,config:{arcd:{companyName:'ARCD'},mrc:{companyName:'MRC'}}});
 const states={};
 for(const company of ['arcd','mrc']){
  const tables=structuredClone(plan.companies[company].tables),view=companySourceView(tables,company).data;
  view.localCompanySimulation={enabled:true,companyId:company};
  if(company==='arcd'){view.transacoes=[];view.despesasEmpresa=[];view.payments=[];}
  if(company==='mrc'){view.obras[0].oneDriveDriveId='local-mrc';view.obras[0].oneDriveFolderId='local:i';}
  tables.company_app_data.find(row=>row.key==='arced_ponto_v1').value=encodeAppData(view);
  states[company]={localOnly:true,companyId:company,sourceHash:plan.sourceHash,revision:1,updatedAt:'2026-11-18T12:00:00Z',data:view,tables};
 }
 return {snapshot,plan,states,stateProof:{status:'verified',sourceHash:plan.sourceHash,afterHash:hash(states.mrc),arcdSha256:hash(states.arcd)},cleanupProof:{passed:true,localOnly:true,afterRevision:1,removed:{transactions:3,generated:2}}};
};
const fixture=()=>prepareCompanyCutover(inputs());
const normalized=tables=>Object.fromEntries(Object.entries(tables).map(([table,rows])=>[table,rows.map(cutoverHash).sort()]));

const withClockEvidence=()=>{
 const input=inputs(),table='ponto_tempo_verificacoes';
 input.snapshot.inventory.push(table);input.snapshot.primaryKeys[table]=['id'];
 input.snapshot.tables[table]=[{id:'ntp-1',fonte:'ntp',servidor:'a.st1.ntp.br',ok:true,offset_ms:2}];
 input.plan.sourceHash=hash(input.snapshot);input.stateProof.sourceHash=input.plan.sourceHash;
 for(const company of ['arcd','mrc'])input.states[company].sourceHash=input.plan.sourceHash;
 input.stateProof.afterHash=hash(input.states.mrc);input.stateProof.arcdSha256=hash(input.states.arcd);
 return input;
};
it('preserva a evidência global de hora sem atribuir empresa, apagar ou duplicar medições',()=>{
 const input=withClockEvidence(),bundle=prepareCompanyCutover(input);
 expect(bundle.after.ponto_tempo_verificacoes).toEqual(input.snapshot.tables.ponto_tempo_verificacoes);
 expect(bundle.order).not.toContain('ponto_tempo_verificacoes');
 expect(bundle.archived.ponto_tempo_verificacoes).toBeUndefined();
 expect(bundle.after.ponto_tempo_verificacoes[0]).not.toHaveProperty('company_id');
});
it('exige nova conferência se evidência de hora adquirir campos empresariais ou escopo de empresa',()=>{
 const repin=input=>{input.plan.sourceHash=hash(input.snapshot);input.stateProof.sourceHash=input.plan.sourceHash;for(const company of ['arcd','mrc'])input.states[company].sourceHash=input.plan.sourceHash;input.stateProof.afterHash=hash(input.states.mrc);input.stateProof.arcdSha256=hash(input.states.arcd);};
 const input=withClockEvidence();input.snapshot.tables.ponto_tempo_verificacoes[0].obra_id='a';repin(input);
 expect(()=>prepareCompanyCutover(input)).toThrow('Esquema da evidência');
 const scoped=withClockEvidence();scoped.snapshot.companyScopedTables.push('ponto_tempo_verificacoes');repin(scoped);
 expect(()=>prepareCompanyCutover(scoped)).toThrow('Esquema da evidência');
});

it('prepara a cópia limpa, mantém o engenheiro e elimina identificadores sintéticos sem certificar a nuvem',()=>{
 const input=inputs(),original=structuredClone(input),bundle=prepareCompanyCutover(input);
 expect(input).toEqual(original);expect(bundle.activationReady).toBe(false);expect(bundle.cleanup.preserved).toBe(true);expect(bundle.fileBindings).toHaveLength(1);
 const mrc=companySourceView(bundle.after,'mrc').data,arcd=companySourceView(bundle.after,'arcd').data;
 expect(mrc.obras.map(work=>work.id)).toEqual(['i','k']);expect(mrc.usuarios.filter(user=>user.id==='eng')).toHaveLength(1);
 expect(arcd.transacoes).toEqual([]);expect(arcd.despesasEmpresa).toEqual([]);expect(arcd.payments).toEqual([]);
 expect(JSON.stringify(bundle.after)).not.toContain('local:i');expect(JSON.stringify(bundle.after)).not.toContain('localCompanySimulation');
 expect(bundle.archived.financial_shadow_runs).toMatchObject({mode:'private-before-image'});
 for(const company of ['arcd','mrc'])expect(bundle.after.company_app_data.find(row=>row.company_id===company&&row.key==='arced_auth_profiles_v1')).toMatchObject({updated_at:'2026-11-18T12:00:00Z',updated_by:null});
});
it('recusa estado alterado após a autorização e pacote adulterado',()=>{
 const input=inputs();input.states.arcd.data.despesasEmpresa.push({id:'new',valor:100});expect(()=>prepareCompanyCutover(input)).toThrow('mudou');
 const bundle=fixture();bundle.after.purchase_requests[0].payload.quantity=123;expect(()=>verifyCutoverBundle(bundle)).toThrow('adulterado');
});
it('recusa dependência de outra empresa e colisão de uma chave global',()=>{
 const input=inputs();input.states.arcd.tables.purchase_requests[0].project_id='i';input.stateProof.arcdSha256=hash(input.states.arcd);
 expect(()=>prepareCompanyCutover(input)).toThrow('entre empresas');
 const other=inputs();other.states.mrc.tables.purchase_requests[0].id='req-a';other.stateProof.afterHash=hash(other.states.mrc);
 expect(()=>prepareCompanyCutover(other)).toThrow('Colisão');
});
it('recusa executores externos e SQL de produção, sem modificar o estado',async()=>{
 const bundle=fixture(),db=await newCutoverRehearsal(bundle);
 try{
  await expect(executeCutoverRehearsal({exec:()=>{}},bundle)).rejects.toThrow('PGlite');
  const before=normalized(await readCutoverRehearsal(db,bundle));
  await expect(db.exec(companyCutoverSql(bundle))).rejects.toThrow('somente local');await db.exec('rollback');
  expect(normalized(await readCutoverRehearsal(db,bundle))).toEqual(before);
 }finally{await db.close();}
});
it('aplica com FKs imediatas, não duplica na repetição e recusa dados novos',async()=>{
 const bundle=fixture(),db=await newCutoverRehearsal(bundle);
 try{
  const after=await executeCutoverRehearsal(db,bundle);expect(verifyRehearsalDre(after,bundle)).toBe(true);
  expect((await db.query("select company_id from purchase_requests where id='req-i'")).rows[0].company_id).toBe('mrc');
  expect((await db.query('select * from financial_shadow_runs')).rows).toEqual([]);
  expect((await db.query("select payload from purchase_requests where id='req-a'")).rows[0].payload.note).toBe("Aspas ' e $migration$ preservados");
  expect(normalized(await executeCutoverRehearsal(db,bundle))).toEqual(normalized(after));
  await db.exec("update purchase_requests set payload='{\"newWrite\":true}' where id='req-i';");
  await expect(executeCutoverRehearsal(db,bundle)).rejects.toThrow('divergente');
  expect((await db.query("select payload from purchase_requests where id='req-i'")).rows[0].payload).toEqual({newWrite:true});
 }finally{await db.close();}
});
it('falha no meio da aplicação e reverte dados e recibo na mesma transação',async()=>{
 const bundle=fixture(),db=await newCutoverRehearsal(bundle);
 try{
  const before=normalized(await readCutoverRehearsal(db,bundle));
  await db.exec("create function fail_cutover_test() returns trigger language plpgsql as $$ begin raise exception 'injected'; end $$; create trigger fail_cutover_test before insert on core_projects for each row execute function fail_cutover_test();");
  await expect(executeCutoverRehearsal(db,bundle)).rejects.toThrow('injected');
  expect(normalized(await readCutoverRehearsal(db,bundle))).toEqual(before);
  expect((await db.query("select to_regclass('company_cutover_private.runs') as table_name")).rows[0].table_name).toBeNull();
 }finally{await db.close();}
});
it('restaura somente a imagem limpa e separada em destino vazio e protege as imagens privadas',async()=>{
 const bundle=fixture(),db=await newCutoverRehearsal(bundle,{empty:true});
 try{
  const restored=await executeCutoverRehearsal(db,bundle,{recovery:true});expect(verifyRehearsalDre(restored,bundle)).toBe(true);
  expect(companySourceView(restored,'arcd').data.transacoes).toEqual([]);
  expect(companySourceView(restored,'mrc').data.obras.map(work=>work.id)).toEqual(['i','k']);
  expect(normalized(await executeCutoverRehearsal(db,bundle,{recovery:true}))).toEqual(normalized(restored));
  await db.exec('set role authenticated;');expect((await db.query('select * from company_app_data')).rows).toEqual([]);
  await expect(db.query('select * from company_cutover_private.runs')).rejects.toMatchObject({code:'42501'});await db.exec('reset role;');
 }finally{await db.close();}
});
it('não restaura por cima de uma base preenchida sem recibo do pacote',async()=>{
 const bundle=fixture(),db=await newCutoverRehearsal(bundle);
 try{
  const before=normalized(await readCutoverRehearsal(db,bundle));
  await expect(executeCutoverRehearsal(db,bundle,{recovery:true})).rejects.toThrow('divergente');
  expect(normalized(await readCutoverRehearsal(db,bundle))).toEqual(before);
 }finally{await db.close();}
});
it('a coleta de catálogo é somente leitura e informa FKs, permissões e gatilhos',async()=>{
 const bundle=fixture(),db=await newCutoverRehearsal(bundle);
 try{
  const result=await db.exec(readFileSync('scripts/sql/company-cutover-preflight.sql','utf8'));
  const catalog=result.find(part=>part.rows?.[0]?.cutover_catalog)?.rows[0].cutover_catalog;
  expect(catalog.transactionReadOnly).toBe('on');
  expect(catalog.catalog.find(table=>table.table_name==='purchase_requests').constraints.some(constraint=>constraint.definition.includes('FOREIGN KEY'))).toBe(true);
  expect(catalog.catalog.find(table=>table.table_name==='company_app_data')).toMatchObject({relrowsecurity:true,policies:[]});
 }finally{await db.close();}
});
