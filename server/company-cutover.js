import {createHash} from 'node:crypto';
import {decodeAppData,encodeAppData,compactProfiles} from './data-codec.js';
import {companySourceView} from './company-source-view.js';
import {assertCompanyProjectScope} from './company-project-guard.js';
import {buildRequestedDreProjectionRows} from './dre-projection.js';
import {canonicalDreEvents} from './financial-dre-integration.js';
import {reconcileK104Attendance} from './company-attendance-reconciliation.js';

export const stableJson=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export const cutoverHash=value=>createHash('sha256').update(stableJson(value)).digest('hex');
export const requireCutover=(condition,message)=>{if(!condition)throw new Error(message);};
export const sqlName=value=>{requireCutover(/^[a-z_][a-z_0-9]*$/.test(value),'Identificador SQL inválido.');return '"'+value+'"';};
export const rowIdentity=(row,keys)=>stableJson(keys.map(key=>row[key]));
const coreKey='arced_ponto_v1',profileKey='arced_auth_profiles_v1';
const stripLocal=value=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='localCompanySimulation'));
export function cutoverDre(tables,company,years=[2026]){
 const view=companySourceView(tables,company);requireCutover(!view.missingArchives.length,'Histórico de mão de obra incompleto.');
 const canonical=canonicalDreEvents({titles:(tables.financial_titles||[]).filter(row=>row.company_id===company),settlements:(tables.settlements||[]).filter(row=>row.company_id===company),banks:(tables.bank_transactions||[]).filter(row=>row.company_id===company)});
 requireCutover(!canonical.issues.length,'Classificação financeira pendente.');
 const requests=years.flatMap(year=>['company_dre',...view.data.obras.map(work=>work.id)].flatMap(scope=>Array.from({length:12},(_,month)=>({year,month,period:'mes',scope}))));
 return buildRequestedDreProjectionRows(view.data,requests,canonical.events).map((row,index)=>({request:requests[index],values:Object.fromEntries(Object.entries(row.payload||{}).filter(([,value])=>typeof value==='number'))}));
}

// Only builds an offline package. It cannot read credentials or open a database.
export function prepareCompanyCutover({snapshot,plan,states,stateProof,cleanupProof,reconciliation,years=[2026]}){
 requireCutover(createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')===plan.sourceHash,'Plano e captura de origem divergem.');
 requireCutover(stateProof.status==='verified','Prova do vínculo técnico inválida.');
 const ordinaryHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 let cleanRevision=states.arcd.revision;
 if(reconciliation){
  const {beforeState,proof}=reconciliation;
  requireCutover(proof.status==='verified'&&proof.passed&&proof.localOnly&&proof.remoteWrites===0&&proof.sourceHash===plan.sourceHash,'Prova da reconciliação inválida.');
  requireCutover(ordinaryHash(beforeState)===stateProof.arcdSha256&&proof.beforeHash===stateProof.arcdSha256&&beforeState.sourceHash===stateProof.sourceHash,'A reconciliação não parte da cópia limpa conferida.');
  const expected=reconcileK104Attendance(beforeState,snapshot,proof.updatedAt);
  requireCutover(ordinaryHash(expected)===proof.afterHash&&ordinaryHash(states.arcd)===proof.afterHash&&proof.mrcSha256===stateProof.afterHash,'A cópia operacional mudou após a conferência autorizada.');
  cleanRevision=beforeState.revision;
 }else requireCutover(stateProof.sourceHash===plan.sourceHash&&ordinaryHash(states.arcd)===stateProof.arcdSha256,'A cópia operacional mudou após a conferência autorizada.');
 requireCutover(ordinaryHash(states.mrc)===stateProof.afterHash,'A cópia operacional mudou após a conferência autorizada.');
 requireCutover(cleanupProof.passed&&cleanupProof.localOnly&&cleanupProof.afterRevision===cleanRevision,'Prova da limpeza da ARCD ausente ou divergente.');
 requireCutover(cleanupProof.removed.transactions===3&&cleanupProof.removed.generated===2,'Limpeza autorizada diferente da conferida.');
 const before=structuredClone(snapshot.tables),after=Object.fromEntries(snapshot.inventory.map(table=>[table,[]]));
 const fileBindings=[];
 for(const company of ['arcd','mrc']){
  const state=states[company];requireCutover(state.localOnly&&state.sourceHash===stateProof.sourceHash&&state.companyId===company,'Estado local de outra captura ou empresa.');
  assertCompanyProjectScope(state.data,plan.projects,company);
  const original=companySourceView(plan.companies[company].tables,company).data;
  const tables=structuredClone(state.tables);
  // Presence is volatile session metadata, never an operational/financial fact.
  // Preserve the captured rows rather than reverting online-session timestamps.
  if(reconciliation)tables.company_app_data=[...tables.company_app_data.filter(row=>!row.key.startsWith('arced_presence__')),...structuredClone(snapshot.tables.company_app_data.filter(row=>row.company_id===company&&row.key.startsWith('arced_presence__')))];
  // Simulator IDs must never be shipped as actual OneDrive destinations.
  const restoreWorkspace=work=>{
   const source=original.obras.find(row=>String(row.id)===String(work.id));requireCutover(source,'Obra sem identidade na origem.');
   const result=Object.fromEntries(Object.entries(work).filter(([key])=>!key.startsWith('oneDrive')));
   Object.assign(result,Object.fromEntries(Object.entries(source).filter(([key])=>key.startsWith('oneDrive'))));
   if(Object.values(work).some(value=>typeof value==='string'&&value.startsWith('local:'))||String(work.oneDriveDriveId||'').startsWith('local-'))fileBindings.push({companyId:company,projectId:String(work.id),status:'requires-verified-cloud-destination'});
   return result;
  };
  const core=tables.company_app_data.find(row=>row.key===coreKey),data=stripLocal(decodeAppData(core.value));
  data.obras=data.obras.map(restoreWorkspace);core.value=encodeAppData(data);
  const index=tables.company_app_data.find(row=>row.key===profileKey);requireCutover(index,'Índice de acesso ausente.');
  index.value=compactProfiles(data);index.value.atualizadoEm=state.updatedAt||snapshot.capturedAt;
  tables.company_app_data=tables.company_app_data.map(row=>{
   const existing=snapshot.tables.company_app_data.find(source=>source.company_id===company&&source.key===row.key);
   const prototype=existing||snapshot.tables.company_app_data.find(source=>source.company_id==='arcd'&&source.key===row.key)||{};
   const complete={...prototype,...row};
   if(!existing||cutoverHash(existing.value)!==cutoverHash(row.value)){
    // Generated compact profiles previously lacked updated_at/updated_by.
    // Complete captured columns and invalidate pre-cutover CAS versions.
    complete.updated_at=state.updatedAt||snapshot.capturedAt;complete.updated_by=null;
   }
   return complete;
  });
  for(const row of tables.core_projects||[]){
   if(!row.payload)continue;
   const work=data.obras.find(work=>String(work.id)===String(row.id));
   if(work){row.payload=Object.fromEntries(Object.entries(row.payload).filter(([key])=>!key.startsWith('oneDrive')));Object.assign(row.payload,Object.fromEntries(Object.entries(work).filter(([key])=>key.startsWith('oneDrive'))));}
  }
  for(const [table,rows]of Object.entries(tables)){
   requireCutover(Object.hasOwn(after,table),'Tabela fora do inventário.');
   for(const row of rows){requireCutover(row.company_id===company,'Linha nativa de outra empresa.');after[table].push(row);}
  }
 }
 // The electronic clock reads these server-wide NTP measurements directly.
 // They carry no company/project/user fields and must not be removed along
 // with legacy unscoped ERP payloads. Never copy them into either company.
 const infrastructureTable='ponto_tempo_verificacoes';
 if(Object.hasOwn(before,infrastructureTable)){
  const columns=new Set(['id','fonte','servidor','verificado_em','offset_ms','atraso_ms','incerteza_ms','estrato','ok','erro','criado_em']);
  requireCutover(!snapshot.companyScopedTables?.includes(infrastructureTable)&&before[infrastructureTable].every(row=>Object.keys(row).every(key=>columns.has(key))),'Esquema da evidência de hora mudou; exige conferência.');
  after[infrastructureTable]=structuredClone(before[infrastructureTable]);
 }
 requireCutover(!after.company_app_data.some(row=>row.key==='marcell_company_isolation_v1'),'Certificado de ativação prematuro.');
 const keys=structuredClone(snapshot.primaryKeys),relations=(snapshot.foreignKeys||[]).filter(relation=>Object.hasOwn(before,relation.table)&&Object.hasOwn(before,relation.references));
 for(const table of snapshot.inventory){
  sqlName(table);
  if(!keys[table]?.length){requireCutover(!before[table]?.length&&!after[table]?.length,'Tabela preenchida sem chave primária conferida.');continue;}
  for(const rows of [before[table]||[],after[table]]){
   const seen=new Set();for(const row of rows){requireCutover(keys[table].every(key=>row[key]!==undefined&&row[key]!==null),'Chave primária ausente.');const id=rowIdentity(row,keys[table]);requireCutover(!seen.has(id),'Colisão de chave primária global ou composta.');seen.add(id);}
  }
 }
 // Also enforce company boundaries on single-ID foreign keys.
 for(const relation of relations){
  if(snapshot.externalTables?.[relation.table]||snapshot.externalTables?.[relation.references])continue;
  const parents=new Map(after[relation.references].map(row=>[rowIdentity(row,relation.referenceColumns),row]));
  for(const child of after[relation.table]){
   if(relation.columns.some(key=>child[key]===null||child[key]===undefined))continue;
   const parent=parents.get(rowIdentity(child,relation.columns));
   requireCutover(parent&&(!child.company_id||!parent.company_id||child.company_id===parent.company_id),'Dependência relacional ausente ou entre empresas.');
  }
 }
 const validation={};
 for(const company of ['arcd','mrc']){
  const actualData=companySourceView(after,company).data,expectedData=states[company].data;
  const facts=data=>Object.fromEntries(Object.entries(data).filter(([key])=>!['obras','usuarios','localCompanySimulation'].includes(key)));
  requireCutover(cutoverHash(facts(actualData))===cutoverHash(facts(expectedData)),'Um fato operacional da cópia limpa foi alterado.');
  requireCutover(cutoverHash(actualData.usuarios)===cutoverHash(expectedData.usuarios),'Perfis de acesso divergentes da cópia autorizada.');
  const projected=cutoverDre(after,company,years),expected=cutoverDre(states[company].tables,company,years);
  requireCutover(cutoverHash(projected)===cutoverHash(expected),'O pacote altera o DRE da cópia limpa.');
  validation[company]={periods:projected.length,dreHash:cutoverHash(projected),factsHash:cutoverHash(facts(actualData)),works:states[company].data.obras.length};
 }
 const changed=snapshot.inventory.filter(table=>!snapshot.externalTables?.[table]&&cutoverHash(before[table]||[])!==cutoverHash(after[table]));
 const dependencies=new Map(changed.map(table=>[table,new Set(relations.filter(r=>r.table===table&&r.references!==table&&changed.includes(r.references)).map(r=>r.references))]));
 const order=[];
 while(order.length<changed.length){const next=changed.filter(table=>!order.includes(table)&&[...dependencies.get(table)].every(parent=>order.includes(parent))).sort();requireCutover(next.length,'Ciclo entre tabelas exige plano específico.');order.push(...next);}
 const archived={};
 for(const [table,count]of Object.entries(plan.historicalArchive.tables))archived[table]={rows:count,mode:snapshot.externalTables?.[table]?'preserve-immutable-source-pending-private-archive':'private-before-image'};
 // Legacy global records have no proven company ownership. Keep their exact
 // before-image privately; never assign them to either active company by guess.
 for(const table of snapshot.inventory.filter(table=>!snapshot.companyScopedTables?.includes(table)&&before[table]?.length&&!after[table].length&&!snapshot.externalTables?.[table]))archived[table]={rows:before[table].length,mode:'private-before-image',reason:'unscoped-legacy-data-requires-explicit-ownership-review'};
 const bundle={version:1,kind:'company-cutover-offline',sourceHash:plan.sourceHash,localOnly:true,activationReady:false,projects:plan.projects,primaryKeys:keys,companyScopedTables:snapshot.companyScopedTables||[],relations,order,before,after,external:structuredClone(snapshot.externalTables||{}),archived,fileBindings,years,validation,
  cleanup:{transactions:3,generated:2,preserved:true},
  ...(reconciliation?{reconciliation:{kind:'k104-attendance-reconciliation',originalSourceHash:stateProof.sourceHash,sourceHash:plan.sourceHash,beforeHash:reconciliation.proof.beforeHash,afterHash:reconciliation.proof.afterHash,mrcHash:stateProof.afterHash}}:{}),
  recoveryPolicy:'restore-clean-separated-target-in-isolated-database; never-publish-mixed-before-image',
  blockers:['fresh-consistent-cutover-capture','full-catalog-types-constraints-triggers-rls-and-global-identities','private-legacy-audit-archive',...(reconciliation?['unscoped-legacy-ownership-and-private-archive-review']:[]),'verified-cloud-files-and-private-photos','real-company-authentication-and-integrations','mrc-fiscal-configuration-and-budget-bases','backup-restore-and-explicit-publication-authorization']};
 return {...bundle,id:cutoverHash(bundle)};
}

export function verifyCutoverBundle(bundle){
 const {id,...content}=bundle;requireCutover(bundle.kind==='company-cutover-offline'&&bundle.localOnly&&bundle.activationReady===false&&id===cutoverHash(content),'Pacote adulterado ou ativação indevida.');return bundle;
}
