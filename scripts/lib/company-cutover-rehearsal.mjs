import {PGlite} from '@electric-sql/pglite';
import {sqlName,requireCutover,verifyCutoverBundle,cutoverDre,cutoverHash} from '../../server/company-cutover.js';
import {companyCutoverSql,relationalOrder} from '../../server/company-cutover-sql.js';

// Captured-key relational mirror: PKs/FKs/RLS are exercised in PostgreSQL.
// Other columns retain captured JSON types. This is not a certified copy of
// production CHECKs, triggers, policies, SQL functions or Auth/Storage schemas.
export async function newCutoverRehearsal(bundle,{empty=false}={}){
 verifyCutoverBundle(bundle);
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const table of Object.keys(bundle.before)){
   const keyColumns=new Set([...(bundle.primaryKeys[table]||[]),...(bundle.companyScopedTables.includes(table)?['company_id']:[])]);
   for(const relation of bundle.relations){if(relation.table===table)relation.columns.forEach(key=>keyColumns.add(key));if(relation.references===table)relation.referenceColumns.forEach(key=>keyColumns.add(key));}
   const columns=new Set([...keyColumns,...[...bundle.before[table],...bundle.after[table]].flatMap(row=>Object.keys(row))]);
   // Unknown empty child-table keys are not invented; catalogue remains a gate.
   if(!columns.size)columns.add('company_id');
   const definitions=[...columns].map(column=>`${sqlName(column)} ${keyColumns.has(column)?'text':'jsonb'}`);
   if(bundle.primaryKeys[table]?.length)definitions.push(`primary key (${bundle.primaryKeys[table].map(sqlName).join(',')})`);
   await db.exec(`create table public.${sqlName(table)} (${definitions.join(',')}); alter table public.${sqlName(table)} enable row level security; grant select,insert,update,delete on public.${sqlName(table)} to anon,authenticated;`);
  }
  for(const relation of bundle.relations){
   const keys=bundle.primaryKeys[relation.references]||[];
   if(JSON.stringify(keys)!==JSON.stringify(relation.referenceColumns))await db.exec(`create unique index ${sqlName('mirror_parent_'+bundle.relations.indexOf(relation))} on public.${sqlName(relation.references)} (${relation.referenceColumns.map(sqlName).join(',')});`);
   await db.exec(`alter table public.${sqlName(relation.table)} add constraint ${sqlName(relation.name)} foreign key (${relation.columns.map(sqlName).join(',')}) references public.${sqlName(relation.references)} (${relation.referenceColumns.map(sqlName).join(',')});`);
  }
  if(!empty){
   const populated=Object.keys(bundle.before).filter(table=>bundle.before[table].length);
   for(const table of relationalOrder(populated,bundle.relations))await db.query(`insert into public.${sqlName(table)} select * from jsonb_populate_recordset(null::public.${sqlName(table)},$1::jsonb)`,[JSON.stringify(bundle.before[table])]);
  }
  return db;
 }catch(error){await db.close();throw error;}
}

export async function readCutoverRehearsal(db,bundle){
 const tables={};for(const table of Object.keys(bundle.before))tables[table]=(await db.query(`select * from public.${sqlName(table)}`)).rows;
 return tables;
}

export async function executeCutoverRehearsal(db,bundle,{recovery=false}={}){
 // No connection string, driver abstraction, environment flags, or hosted DB
 // can be passed through this entry point.
 requireCutover(db instanceof PGlite,'Somente PGlite local é permitido.');
 try{await db.exec(companyCutoverSql(bundle,{rehearsal:true,recovery}));}
 catch(error){try{await db.exec('rollback;');}catch{}throw error;}
 return readCutoverRehearsal(db,bundle);
}

export function verifyRehearsalDre(tables,bundle){
 for(const company of ['arcd','mrc'])requireCutover(cutoverHash(cutoverDre(tables,company,bundle.years))===bundle.validation[company].dreHash,'DRE divergente após execução SQL.');
 return true;
}
