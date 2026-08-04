import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { decodeAppData } from "../server/data-codec.js";
import {
  buildLegacyFinancialFacts, compareFinancialScopes,
  compareDreProjectionRows,
  summarizeCanonicalFinancialRows, summarizeLegacyFinancialFacts,
} from "../server/financial-shadow.js";

if(process.env.VERCEL_ENV!=="production"){
  process.stdout.write("FIN-002: ambiente não produtivo; migration automática ignorada.\n");
  process.exit(0);
}

const required=["POSTGRES_URL_NON_POOLING","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"];
const missing=required.filter(name=>!process.env[name]);
if(missing.length)throw new Error(`FIN-002: variáveis ausentes: ${missing.join(", ")}.`);

const company=process.env.COMPANY_ID||"arcd";
const key="arced_ponto_v1";
const sql=postgres(process.env.POSTGRES_URL_NON_POOLING,{ssl:"require",max:1,connect_timeout:20,idle_timeout:5});
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
for(const migration of [
  "../migrations/001_sync_legacy_financial.up.sql",
  "../migrations/002_financial_transactional_projection.up.sql",
  "../migrations/003_accounting_period_enforcement.up.sql",
  "../migrations/004_financial_events_projection_conflict.up.sql",
  "../migrations/20260726_auth_rate_limit.sql",
  "../migrations/20260727_auth_rate_limit_success.sql",
]){
  await sql.unsafe(fs.readFileSync(new URL(migration,import.meta.url),"utf8"));
}
const {data:row,error:loadError}=await db.from("company_app_data").select("value").eq("company_id",company).eq("key",key).maybeSingle();
if(loadError){await sql.end({timeout:2});throw loadError;}
if(!row?.value){await sql.end({timeout:2});process.stdout.write("FIN-002: migration aplicada; não há dataset legado para carregar.\n");process.exit(0);}

const snapshot=buildLegacyFinancialFacts(decodeAppData(row.value));
const [syncRow]=await sql`
  select financial_sync_legacy_facts(
    ${company}, ${"system:production-deploy"}, ${sql.json(snapshot)}
  ) as result
`;
const sync=syncRow.result;
await sql.end({timeout:2});

const all=async(table,columns)=>{
  const rows=[];
  for(let from=0;;from+=1000){
    const {data,error}=await db.from(table).select(columns).eq("company_id",company).range(from,from+999);
    if(error)throw error;rows.push(...(data||[]));if((data||[]).length<1000)break;
  }
  return rows;
};
const [titles,settlements,events]=await Promise.all([
  all("financial_titles","id,obra_id,direction,status,metadata"),
  all("settlements","id,title_id,amount,status,metadata"),
  all("financial_events","id,event_type,source_id,payload"),
]);
const divergences=compareFinancialScopes(
  summarizeLegacyFinancialFacts(snapshot),
  summarizeCanonicalFinancialRows({titles,settlements,events}),
);
const dreDivergences=compareDreProjectionRows(snapshot.dreSnapshots,events);
if(divergences.length||dreDivergences.length){
  process.stderr.write(`FIN-002 detalhes: ${JSON.stringify({financial:divergences.slice(0,20),dre:dreDivergences.slice(0,20)})}\n`);
  throw new Error(`FIN-002: gate recusado; ${divergences.length} divergência(s) financeira(s) e ${dreDivergences.length} divergência(s) no DRE.`);
}
process.stdout.write(`FIN-002: migration e carga concluídas; ${sync.facts} fatos, ${sync.settlements} liquidações, ${sync.dreSnapshots} projeções DRE, 0 divergências.\n`);
