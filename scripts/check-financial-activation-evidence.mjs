import {createClient} from "@supabase/supabase-js";
import {decodeAppData} from "../server/data-codec.js";
import {normalizeArchivedCosts,summarizeArchivedCosts} from "../server/archived-costs.js";
import {mergeFinancialSourceRows} from "../server/financial-source-snapshot.js";
import {
  buildLegacyFinancialFacts,
  compareDreProjectionRows,
  compareFinancialScopes,
  summarizeCanonicalFinancialRows,
  summarizeLegacyFinancialFacts,
} from "../server/financial-shadow.js";
import {compareProcurementDreRecognition} from "../server/procurement-financial-facts.js";
import {auditCanonicalFinancialIntegrity} from "../server/financial-integrity.js";
import {findStaleFinancialLegacyLinks} from "../server/financial-legacy-link-integrity.js";
import {financialActivationEvidenceGate} from "../server/financial-write-policy.js";
import {comSql,fecharConexaoSql} from "../server/pg-conexao.js";

const URL=process.env.SUPABASE_URL;
const SERVICE=process.env.SUPABASE_SERVICE_ROLE_KEY;
const DIRECT=process.env.POSTGRES_URL_NON_POOLING;
const COMPANY=process.env.COMPANY_ID||"arcd";
const KEY="arced_ponto_v1";

if(!URL||!SERVICE){
  console.error("FIN-9.6: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.");
  process.exit(2);
}
if(!DIRECT){
  console.error("FIN-9.6: POSTGRES_URL_NON_POOLING é obrigatória para provar os hashes dos vínculos legados.");
  process.exit(2);
}

const db=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});

const all=async(table,columns)=>{
  const rows=[];
  for(let from=0;;from+=1000){
    const {data,error}=await db.from(table).select(columns).eq("company_id",COMPANY).range(from,from+999);
    if(error)throw new Error(`${table}: ${error.message}`);
    rows.push(...(data||[]));
    if((data||[]).length<1000)return rows;
  }
};

try{
  const sourceRows=await all("company_app_data","key,value,updated_at");
  const coreRow=sourceRows.find(row=>row.key===KEY);
  if(!coreRow){
    console.error(`FIN-9.6: dataset principal ${COMPANY}/${KEY} não encontrado.`);
    process.exit(2);
  }
  const splitRows=sourceRows.filter(row=>String(row.key||"").startsWith(`${KEY}__`));
  let source=mergeFinancialSourceRows(decodeAppData(coreRow.value),splitRows,KEY);

  // Mesma regra de anexarCustosArquivados() da API: o cache do blob não é
  // confiável; cada quinzena fechada é recalculada a partir da linha de
  // arquivo imutável antes da comparação financeira.
  const archivedLaborCosts={};
  for(const quinzenaId of Object.keys(source?.quinzenasArquivadas||{})){
    const row=sourceRows.find(item=>item.key===`${KEY}__arq__${quinzenaId}`);
    if(!row)continue;
    archivedLaborCosts[quinzenaId]=normalizeArchivedCosts(
      summarizeArchivedCosts(row.value,source?.config),
    );
  }
  source={...source,archivedLaborCosts};

  const snapshot=buildLegacyFinancialFacts(source);
  const legacy=summarizeLegacyFinancialFacts(snapshot);

  const [
    titles,settlements,events,banks,reconciliationLinks,legacyLinks,
    accountingPeriods,qualityCases,shadowRuns,
  ]=await Promise.all([
    all("financial_titles","id,obra_id,direction,original_amount,status,metadata"),
    all("settlements","id,title_id,bank_transaction_id,amount,status,metadata"),
    all("financial_events","id,event_type,source_id,effective_date,payload"),
    all("bank_transactions","id,direction,amount,status,metadata"),
    all("reconciliation_links","id,bank_transaction_id,title_id,settlement_id,amount,status"),
    all("legacy_record_links","legacy_type,legacy_id,canonical_type,canonical_id"),
    all("accounting_periods","id,starts_on,ends_on,status"),
    all("data_quality_cases","id,status,category,details"),
    all("financial_shadow_runs","id,created_at,result"),
  ]);

  const canonical=summarizeCanonicalFinancialRows({titles,settlements,events});
  const divergences=compareFinancialScopes(legacy,canonical);
  const dreDivergences=compareDreProjectionRows(snapshot.dreSnapshots,events);
  const procurementDreDivergences=compareProcurementDreRecognition(source,events);
  const linkedLegacyKeys=new Set(legacyLinks.map(link=>
    `${String(link.legacy_type||"")}:${String(link.legacy_id||"")}`
  ));
  const missingLegacyLinks=snapshot.facts
    .filter(fact=>!linkedLegacyKeys.has(`${String(fact.legacyType||"")}:${String(fact.legacyId||"")}`))
    .map(fact=>({legacyType:String(fact.legacyType||""),legacyId:String(fact.legacyId||"")}));
  const staleLegacyLinks=await comSql(sql=>findStaleFinancialLegacyLinks({
    sql,companyId:COMPANY,facts:snapshot.facts,
  }));
  const openQualityCases=qualityCases.filter(item=>
    item.status==="open"&&/^(financial_|reconciliation_)/.test(String(item.category||""))
  );
  const shadowRun=[...shadowRuns].sort((a,b)=>
    String(b.created_at||"").localeCompare(String(a.created_at||""))
  )[0]||null;
  const canonicalIntegrity=auditCanonicalFinancialIntegrity({
    titles,settlements,banks,reconciliationLinks,legacyLinks,accountingPeriods,
  });
  const gate=financialActivationEvidenceGate({
    factsCount:snapshot.facts.length,
    shadowRun,
    divergences,
    dreDivergences,
    procurementDreDivergences,
    missingLegacyLinks,
    legacyHashesVerified:true,
    staleLegacyLinks,
    openQualityCases,
    canonicalIntegrity,
  });

  const report={
    ready:gate.ready,
    company:COMPANY,
    engineEnforced:process.env.FINANCIAL_ENGINE_ENFORCE==="true",
    checks:gate.checks,
    counts:{
      facts:snapshot.facts.length,
      bankTransactions:snapshot.bankTransactions.length,
      titles:titles.length,
      activeSettlements:settlements.filter(row=>row.status==="active").length,
      activeReconciliationLinks:reconciliationLinks.filter(row=>row.status==="active").length,
      legacyLinks:legacyLinks.length,
      missingLegacyLinks:missingLegacyLinks.length,
      staleLegacyLinks:staleLegacyLinks.length,
      ledgerDivergences:divergences.length,
      dreDivergences:dreDivergences.length,
      procurementDreDivergences:procurementDreDivergences.length,
      openQualityCases:openQualityCases.length,
      canonicalIntegrityErrors:canonicalIntegrity.counts.errors,
      canonicalIntegrityWarnings:canonicalIntegrity.counts.warnings,
    },
    lastShadowRun:shadowRun?.created_at||null,
    blockers:gate.blockers,
  };

  console.log(JSON.stringify(report,null,2));

  if(!gate.ready){
    const details={
      missingLegacyLinks:missingLegacyLinks.slice(0,20),
      staleLegacyLinks:staleLegacyLinks.slice(0,20).map(item=>({
        legacyType:item.legacyType,legacyId:item.legacyId,
      })),
      canonicalIntegrityErrors:canonicalIntegrity.errors.slice(0,20),
      ledgerDivergences:divergences.slice(0,20),
      dreDivergences:dreDivergences.slice(0,20),
      procurementDreDivergences:procurementDreDivergences.slice(0,20),
      openQualityCases:openQualityCases.slice(0,20).map(item=>({
        id:item.id,category:item.category,details:item.details,
      })),
    };
    console.error("FIN-9.6 bloqueado:\n"+JSON.stringify(details,null,2));
    process.exitCode=1;
  }else{
    console.log("FIN-9.6: gate de ativação aprovado. A ativação continua sendo uma decisão explícita de deploy.");
  }
}finally{
  await fecharConexaoSql();
}
