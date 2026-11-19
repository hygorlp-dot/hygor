import {verifyCutoverBundle,sqlName,rowIdentity,stableJson,requireCutover} from './company-cutover.js';
import {assertCutoverPreservation} from './company-cutover-preservation.js';
import {assertCompanyCutoverApproval} from './company-cutover-approval.js';
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const string=value=>"'"+String(value).replaceAll("'","''")+"'";
const tableName=table=>'public.'+sqlName(table);
const records=(table,rows)=>`select * from jsonb_populate_recordset(null::${tableName(table)},${literal(rows)})`;
const imageRecords=(table,expression)=>`select * from jsonb_populate_recordset(null::${tableName(table)},${expression})`;
const scope=(bundle,table)=>{
 const conditions=bundle.companyScopedTables.includes(table)?["company_id in ('arcd','mrc')"]:[];
 if(bundle.preservation&&table==='company_app_data')conditions.push("key <> 'onedrive_auth_v1' and left(key,16) <> 'arced_presence__'");
 return conditions.length?' where '+conditions.join(' and '):'';
};
const actual=(bundle,table)=>`select to_jsonb(t) as value from ${tableName(table)} t${scope(bundle,table)}`;
const expected=(table,rows,expression)=>`select to_jsonb(t) as value from (${expression?imageRecords(table,expression):records(table,rows)}) t`;
const assertTable=(bundle,table,rows,expression)=>`if exists ((${actual(bundle,table)}) except (${expected(table,rows,expression)})) or exists ((${expected(table,rows,expression)}) except (${actual(bundle,table)})) then raise exception 'Estado divergente em ${table}; operação recusada'; end if;`;
const predicate=(table,keys,row)=>keys.map(key=>`t.${sqlName(key)} is not distinct from (jsonb_populate_record(null::${tableName(table)},${literal(row)})).${sqlName(key)}`).join(' and ');

export function cutoverDelta(bundle){
 return Object.fromEntries(bundle.order.map(table=>{
  const keys=bundle.primaryKeys[table],before=new Map(bundle.before[table].map(row=>[rowIdentity(row,keys),row])),after=new Map(bundle.after[table].map(row=>[rowIdentity(row,keys),row]));
  return [table,{insert:[...after].filter(([id])=>!before.has(id)).map(([,row])=>row),update:[...after].filter(([id,row])=>before.has(id)&&stableJson(row)!==stableJson(before.get(id))).map(([,row])=>row),delete:[...before].filter(([id])=>!after.has(id)).map(([,row])=>row)}];
 }));
}

// This is deliberately a blocked draft for a real database. Only the isolated
// PGlite rehearsal can generate the executable variant in memory.
export function companyCutoverSql(bundle,{rehearsal=false,recovery=false}={}){
 return buildCutoverTransaction(bundle,{rehearsal,recovery});
}

// This entry point is used only by the private migration artifact generator.
// No API endpoint or browser request can supply an approval to this compiler.
export function approvedCompanyCutoverSql(bundle,approval,options){
 assertCompanyCutoverApproval(bundle,approval,options);
 return buildCutoverTransaction(bundle,{approved:true,approvalExpiresAt:approval.expiresAt});
}

function buildCutoverTransaction(bundle,{rehearsal=false,recovery=false,approved=false,approvalExpiresAt}={}){
 verifyCutoverBundle(bundle);
 assertCutoverPreservation(bundle);
 requireCutover(!recovery||!bundle.preservation,'Recuperação exige o pacote integral em base nova; o plano de preservação não contém os controles vivos.');
 const delta=cutoverDelta(bundle),tables=Object.keys(bundle.before).filter(table=>!bundle.external[table]&&!bundle.preservation?.tables.includes(table)).sort();
 const tag='$cutover_'+bundle.id+'$';
 requireCutover(!JSON.stringify([bundle.before,bundle.after]).includes(tag),'Delimitador SQL conflitante.');
 const gates=approved?`if clock_timestamp() >= ${string(approvalExpiresAt)}::timestamptz then raise exception 'Corte expirado; recapturar e conferir'; end if;`:rehearsal?'':"raise exception 'Pacote somente local: captura, catálogo, arquivos e ativação real ainda não certificados';";
 const lines=[`-- ${recovery?'RECUPERAÇÃO LIMPA EM BASE ISOLADA':'APLICAÇÃO TRANSACIONAL'} | ${bundle.id}`,
  approved?'-- Transação aprovada por corte e evidências; não instala certificado de ativação.':'-- Rascunho bloqueado para produção. Sem credenciais e sem certificados de ativação.',
  'begin;',"set local standard_conforming_strings=on;","set local lock_timeout='5s';","set local statement_timeout='180s';",
  `do $gate$ begin ${gates} end $gate$;`,
  'create schema if not exists company_cutover_private;',
  'revoke all on schema company_cutover_private from public,anon,authenticated,service_role;',
  'create table if not exists company_cutover_private.runs (id text primary key, before_image jsonb not null, clean_image jsonb not null, mode text not null, applied_at timestamptz not null default now());',
  'revoke all on all tables in schema company_cutover_private from public,anon,authenticated,service_role;',
  'alter table company_cutover_private.runs enable row level security;',
  `lock table ${tables.map(tableName).join(',')} in share row exclusive mode;`,
  `do ${tag} declare expected_before_image jsonb := ${literal(bundle.before)}; expected_after_image jsonb := ${literal(bundle.after)}; previous company_cutover_private.runs%rowtype; begin`,
  ...(approved?[gates]:[]),
  `select * into previous from company_cutover_private.runs where id=${string(bundle.id)} for update;`,
  `if found then if previous.clean_image<>expected_after_image or previous.before_image<>expected_before_image then raise exception 'Recibo divergente'; end if;`,
  ...tables.map(table=>assertTable(bundle,table,bundle.after[table],`expected_after_image->${string(table)}`)),
  'return; end if;'];
 if(recovery){
  // No overwrite is allowed in recovery: the destination must be empty for
  // both companies (and all captured global child tables).
  for(const table of tables)lines.push(assertTable(bundle,table,[]));
  const populated=tables.filter(table=>bundle.after[table].length);
  const order=relationalOrder(populated,bundle.relations);
  for(const table of order)lines.push(`insert into ${tableName(table)} overriding system value ${records(table,bundle.after[table])};`);
 }else{
  for(const table of tables)lines.push(assertTable(bundle,table,bundle.before[table]||[],`expected_before_image->${string(table)}`));
  for(const table of bundle.order)if(delta[table].insert.length)lines.push(`insert into ${tableName(table)} overriding system value ${records(table,delta[table].insert)};`);
  for(const table of bundle.order)for(const row of delta[table].update){
   const columns=Object.keys(row).filter(key=>!bundle.primaryKeys[table].includes(key));
   requireCutover(columns.length,'Atualização vazia.');
   const list=columns.map(sqlName).join(',');
   lines.push(`update ${tableName(table)} t set (${list})=(select ${list} from jsonb_populate_record(null::${tableName(table)},${literal(row)})) where ${predicate(table,bundle.primaryKeys[table],row)};`);
  }
  for(const table of [...bundle.order].reverse())for(const row of delta[table].delete)lines.push(`delete from ${tableName(table)} t where ${predicate(table,bundle.primaryKeys[table],row)};`);
 }
 for(const table of tables)lines.push(assertTable(bundle,table,bundle.after[table],`expected_after_image->${string(table)}`));
 lines.push(`insert into company_cutover_private.runs(id,before_image,clean_image,mode) values (${string(bundle.id)},expected_before_image,expected_after_image,${string(recovery?'clean-isolated-recovery':'cutover')});`,
  `end ${tag};`,
  'commit;');
 return lines.join('\n');
}

export function relationalOrder(tables,relations){
 const order=[];
 while(order.length<tables.length){
  const next=tables.filter(table=>!order.includes(table)&&relations.filter(r=>r.table===table&&r.references!==table&&tables.includes(r.references)).every(r=>order.includes(r.references))).sort();
  requireCutover(next.length,'Ciclo relacional exige estratégia própria.');order.push(...next);
 }
 return order;
}
