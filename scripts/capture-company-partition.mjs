import {loadEnv} from 'vite';
import postgres from 'postgres';
import {readFile,writeFile,mkdir,open,stat,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {captureTable,captureFingerprint} from './lib/company-capture.mjs';

// A consistent read-only snapshot. No migration, RPC or UPDATE runs here.
const args=process.argv.slice(2),index=args.indexOf('--output');
if(index<0||!args[index+1])throw new Error('Informe --output com um arquivo privado fora do repositório.');
const output=resolve(args[index+1]);
if(output.startsWith(resolve('.')+'\\')||output.startsWith(resolve('.')+'/'))throw new Error('Guarde o snapshot privado fora do repositório.');
const env=loadEnv('development',process.cwd(),'');
const db=env.POSTGRES_URL_NON_POOLING?postgres(env.POSTGRES_URL_NON_POOLING,{max:1,connect_timeout:15,idle_timeout:5}):null;
async function captureViaDataApi(){
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Origem de leitura não configurada.');
  const readOnlyFetch=(url,options={})=>{
    if(!['GET','HEAD'].includes(String(options.method||'GET').toUpperCase()))throw new Error('Gravação remota bloqueada nesta captura.');
    return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(45000)});
  };
  const metadataIndex=args.indexOf('--inventory');
  const metadata=metadataIndex>=0?JSON.parse(await readFile(args[metadataIndex+1],'utf8')):null;
  const verifiedInventory=metadata?.inventory;
  if(!verifiedInventory?.length||!verifiedInventory.some(item=>item.table==='company_app_data')||verifiedInventory.some(item=>!item.primaryKey?.length||!/^[a-z_][a-z_0-9]*$/.test(item.table)))throw new Error('Informe --inventory com tabelas e chaves primárias conferidas no banco.');
  const remote=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:readOnlyFetch}});
  const readPage=async({table,company,primaryKey,start,end,count})=>{
    if(table==='audit_events'){
      // Page the narrow identity index first. Sorting/offsetting the full
      // before/after snapshots forces expensive serialization of skipped rows.
      let index=remote.from(table).select('id,company_id',count?{count:'exact'}:{}).eq('company_id',company);
      if(metadata.cutoff)index=index.lte('created_at',metadata.cutoff);
      const identities=await index.order('created_at',{ascending:false}).order('id',{ascending:true}).range(start,end);
      if(identities.error||!identities.data?.length)return identities;
      const fetchPayload=async ids=>{
        const page=await remote.from(table).select('*').eq('company_id',company).in('id',ids);
        if(page.error&&(page.error.code==='57014'||[0,502,503,504].includes(page.status))&&ids.length>1){
          const middle=Math.ceil(ids.length/2);
          const left=await fetchPayload(ids.slice(0,middle));if(left.error)return left;
          const right=await fetchPayload(ids.slice(middle));if(right.error)return right;
          return {data:[...left.data,...right.data],error:null};
        }
        return page;
      };
      const data=[];
      for(let index=0;index<identities.data.length;index+=10){
        const page=await fetchPayload(identities.data.slice(index,index+10).map(row=>row.id));
        if(page.error)return page;
        data.push(...page.data);
      }
      return {data,error:null,count:identities.count};
    }
    let query=remote.from(table).select('*',count?{count:'exact'}:{}).eq('company_id',company);
    for(const key of primaryKey)query=query.order(key,{ascending:true});
    return query.range(start,end);
  };
  const pageSizeFor=table=>table.startsWith('budget_reference_')?1000:table==='audit_events'?50:table==='company_app_data'||table==='company_app_data_backup'?10:200;
  const tables={},fingerprints={},externalTables={},cacheDirectory=output+'.parts';
  await mkdir(cacheDirectory,{recursive:true});
  const orderedInventory=[...verifiedInventory].sort((a,b)=>a.table==='company_app_data'?-1:b.table==='company_app_data'?1:a.table.localeCompare(b.table));
  for(const {table,primaryKey} of orderedInventory){
    if(!/^[a-z_][a-z_0-9]*$/.test(table))throw new Error('Nome de tabela inválido no inventário.');
    const started=Date.now(),cachePath=`${cacheDirectory}/${table}.json`;
    let cached=null;
    if(args.includes('--resume'))try{cached=JSON.parse(await readFile(cachePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(cached){
      if(cached.external){
        if((await stat(cached.path)).size!==cached.bytes)throw new Error(`Arquivo externo de ${table} não confere.`);
        externalTables[table]=cached;tables[table]=[];
      }else{
        if(JSON.stringify(cached.primaryKey)!==JSON.stringify(primaryKey)||captureFingerprint(cached.rows)!==cached.fingerprint)throw new Error(`Cópia local de ${table} não confere.`);
        tables[table]=cached.rows;
      }
    }else if(table==='audit_events'||table.startsWith('budget_reference_')&&table!=='budget_reference_bases'){
      const path=`${cacheDirectory}/${table}.ndjson`;
      try{await stat(path);await rename(path,path+`.incomplete-${Date.now()}`);}catch(error){if(error.code!=='ENOENT')throw error;}
      const file=await open(path,'wx',0o600),checksum=createHash('sha256');let bytes=0;
      let captured;
      try{
        captured=await captureTable({table,primaryKey,readPage,pageSize:pageSizeFor(table),consume:async rows=>{
          for(const row of rows){const line=JSON.stringify(row)+'\n';await file.writeFile(line);checksum.update(line);bytes+=Buffer.byteLength(line);}
        },onProgress:progress=>{if(progress.rows%1000<pageSizeFor(table)*4)console.log(JSON.stringify({phase:'stream',...progress}));}});
      }finally{await file.close();}
      externalTables[table]={external:true,path,primaryKey,...captured,bytes,sha256:checksum.digest('hex'),...(table==='audit_events'?{auditCutoff:metadata.cutoff,nativeProofBefore:metadata.auditNativeProof,nativeProofAfter:null}:{})};
      if(table==='audit_events'&&(captured.rowCount!==metadata.auditNativeProof?.rows||captured.identityDigest!==metadata.auditNativeProof?.identityDigest))throw new Error('A lista de identidades da auditoria mudou.');
      tables[table]=[];
      await writeFile(cachePath,JSON.stringify(externalTables[table]),{flag:'wx',mode:0o600});
    }else{
      tables[table]=await captureTable({table,primaryKey,readPage,pageSize:pageSizeFor(table)});
      await writeFile(cachePath,JSON.stringify({primaryKey,rows:tables[table],fingerprint:captureFingerprint(tables[table])}),{flag:'wx',mode:0o600});
    }
    fingerprints[table]=externalTables[table]?.fingerprint||captureFingerprint(tables[table]);
    console.log(JSON.stringify({phase:cached?'resume':'capture',table,rows:externalTables[table]?.rowCount??tables[table].length,ms:Date.now()-started}));
  }
  for(const {table,primaryKey} of orderedInventory){
    if(externalTables[table]){
      if(table==='audit_events'){console.log(JSON.stringify({phase:'await-native-audit-proof',table,rows:externalTables[table].rowCount}));continue;}
      const verified=await captureTable({table,primaryKey,readPage,pageSize:pageSizeFor(table),consume:async()=>{}});
      if(verified.fingerprint!==fingerprints[table])throw new Error(`O catálogo ${table} mudou durante a captura.`);
      console.log(JSON.stringify({phase:'verify-external',table,rows:verified.rowCount}));continue;
    }
    let verified=false;
    for(let attempt=0;attempt<3;attempt++){
      const rows=await captureTable({table,primaryKey,readPage,pageSize:pageSizeFor(table)}),fingerprint=captureFingerprint(rows);
      if(fingerprints[table]===fingerprint){verified=true;break;}
      tables[table]=rows;fingerprints[table]=fingerprint;
      await writeFile(`${cacheDirectory}/${table}.json`,JSON.stringify({primaryKey,rows,fingerprint}),{mode:0o600});
      console.log(JSON.stringify({phase:'recapture-changed-table',table,rows:rows.length}));
    }
    if(!verified)throw new Error(`A origem continua mudando em ${table}; as partes locais foram preservadas para retomar com --resume.`);
    console.log(JSON.stringify({phase:'verify',table,rows:tables[table].length}));
  }
  return {complete:false,capturedAt:new Date().toISOString(),auditCutoff:metadata.cutoff||null,inventory:verifiedInventory.map(item=>item.table),primaryKeys:Object.fromEntries(verifiedInventory.map(item=>[item.table,item.primaryKey])),fingerprints,externalTables,tables,
    note:'Captura somente de leitura pela Data API, conferida por segunda leitura. Arquivos externos, vínculos e DRE ainda exigem conferência. Não equivale a transação de migração.'};
}
try{
  const snapshot=db?await db.begin(async tx=>{
    await tx`set transaction isolation level repeatable read, read only`;
    await tx`set local statement_timeout = '45s'`;
    const inventory=await tx`select c.table_name from information_schema.columns c
      join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
      where c.table_schema='public' and c.column_name='company_id' and t.table_type='BASE TABLE'
      order by c.table_name`;
    const tables={};
    for(const {table_name:table} of inventory)tables[table]=await tx`select * from ${tx('public.'+table)} where company_id in ('arcd','mrc')`;
    return {complete:false,capturedAt:new Date().toISOString(),inventory:inventory.map(row=>row.table_name),tables,
      note:'Inventário relacional capturado. Arquivos externos, vínculos imutáveis e conferência do DRE ainda exigem revisão antes de marcar complete.'};
  }):await captureViaDataApi();
  await writeFile(output,JSON.stringify(snapshot),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({capturedAt:snapshot.capturedAt,tables:snapshot.inventory.length,rows:Object.entries(snapshot.tables).reduce((sum,[table,rows])=>sum+(snapshot.externalTables?.[table]?.rowCount??rows.length),0),readOnly:true}));
}finally{if(db)await db.end();}
