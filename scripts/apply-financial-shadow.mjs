import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { repairLockedReconciliation } from "../server/reconciliation-repair.js";
import { mergeFinancialSourceRows } from "../server/financial-source-snapshot.js";
import { compareProcurementDreRecognition } from "../server/procurement-financial-facts.js";
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
  "../migrations/20261023144434_api_reconciliation_integrity.up.sql",
  "../migrations/004_financial_events_projection_conflict.up.sql",
  "../migrations/008_skip_dre_snapshot_sync_on_write.up.sql",
  "../migrations/20261023154632_dre_cash_allocations.up.sql",
  "../migrations/022_closed_period_legacy_source_guard.up.sql",
  "../migrations/20260726_auth_rate_limit.sql",
  "../migrations/20260727_auth_rate_limit_success.sql",
]){
  await sql.unsafe(fs.readFileSync(new URL(migration,import.meta.url),"utf8"));
}
const loaded=await sql.begin(async tx=>{
  const [row]=await tx`select value from company_app_data where company_id=${company} and key=${key} for update`;
  if(!row?.value)return null;
  const repaired=await repairLockedReconciliation(tx,row,company);
  const sourceRows=await tx`select key,value,updated_at from company_app_data where company_id=${company} and key like ${`${key}__%`}`;
  const sourceData=mergeFinancialSourceRows(repaired.data,sourceRows,key);
  const snapshot=buildLegacyFinancialFacts(sourceData);
  const [syncRow]=await tx`select financial_sync_legacy_facts(${company},${"system:production-deploy"},${tx.json(snapshot)}) as result`;
  return {sourceData,snapshot,sync:syncRow.result,repairs:repaired.changes.length};
});
await sql.end({timeout:2});
if(!loaded){process.stdout.write("FIN-002: migration aplicada; não há dataset legado para carregar.\n");process.exit(0);}
const {sourceData,snapshot,sync}=loaded;
process.stdout.write(`REC-002: ${loaded.repairs} associações históricas corrigidas; pagamentos preservados.\n`);

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
  all("financial_events","id,event_type,source_id,effective_date,payload"),
]);
const divergences=compareFinancialScopes(
  summarizeLegacyFinancialFacts(snapshot),
  summarizeCanonicalFinancialRows({titles,settlements,events}),
);
const dreDivergences=compareDreProjectionRows(snapshot.dreSnapshots,events);
const purchaseDivergences=compareProcurementDreRecognition(sourceData,events);
if(divergences.length||dreDivergences.length||purchaseDivergences.length){
  process.stderr.write(`FIN-002 detalhes: ${JSON.stringify({financial:divergences.slice(0,20),dre:dreDivergences.slice(0,20),comprasDre:purchaseDivergences.slice(0,20)})}\n`);
  throw new Error(`FIN-002: gate recusado; ${divergences.length} divergência(s) financeira(s), ${dreDivergences.length} no DRE e ${purchaseDivergences.length} entre Compras e DRE.`);
}
process.stdout.write(`FIN-002: migration e carga concluídas; ${sync.facts} fatos, ${sync.settlements} liquidações, ${sync.dreSnapshots} projeções DRE, 0 divergências.\n`);
