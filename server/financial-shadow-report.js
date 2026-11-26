import { currentCompany } from "./company-context.js";
import { comSql } from "./pg-conexao.js";
import { financialActivationEvidenceGate } from "./financial-write-policy.js";
import { buildLegacyFinancialFacts, compareDreProjectionRows, compareFinancialScopes, summarizeCanonicalFinancialRows, summarizeLegacyFinancialFacts } from "./financial-shadow.js";
import { auditCanonicalFinancialIntegrity } from "./financial-integrity.js";
import { compareLegacyBankTransactions } from "./financial-bank-shadow.js";
import { findStaleFinancialLegacyLinks } from "./financial-legacy-link-integrity.js";
import { compareProcurementDreRecognition } from "./procurement-financial-facts.js";

export function createFinancialShadowReport({ db, exigirCustosArquivados, engineEnforced: FINANCIAL_ENGINE_ENFORCE }) {
  const listarTabelaFinanceira = async (table, columns) => {
    const rows=[];
    for(let from=0;;from+=1000){
      const {data,error}=await db.from(table).select(columns).eq("company_id",currentCompany()).range(from,from+999);
      if(error)throw error;
      rows.push(...(data||[]));
      if((data||[]).length<1000)break;
    }
    return rows;
  };

  const relatorioSombraFinanceira = async atual => {
    const fonteFinanceira=await exigirCustosArquivados(atual);
    const snapshot=buildLegacyFinancialFacts(fonteFinanceira);
    const legado=summarizeLegacyFinancialFacts(snapshot);
    const [titles,settlements,events,banks,reconciliationLinks,legacyLinks,accountingPeriods,qualityCases,runs]=await Promise.all([
      listarTabelaFinanceira("financial_titles","id,obra_id,direction,original_amount,status,metadata"),
      listarTabelaFinanceira("settlements","id,title_id,bank_transaction_id,amount,status,metadata"),
      listarTabelaFinanceira("financial_events","id,event_type,source_id,effective_date,payload"),
      listarTabelaFinanceira("bank_transactions","id,booking_date,direction,amount,raw_description,status,metadata"),
      listarTabelaFinanceira("reconciliation_links","id,bank_transaction_id,title_id,settlement_id,amount,status"),
      listarTabelaFinanceira("legacy_record_links","legacy_type,legacy_id,canonical_type,canonical_id"),
      listarTabelaFinanceira("accounting_periods","id,starts_on,ends_on,status"),
      listarTabelaFinanceira("data_quality_cases","id,status,category,details"),
      listarTabelaFinanceira("financial_shadow_runs","id,created_at,result"),
    ]);
    const canonico=summarizeCanonicalFinancialRows({titles,settlements,events});
    const divergencias=compareFinancialScopes(legado,canonico);
    const divergenciasDRE=compareDreProjectionRows(snapshot.dreSnapshots,events);
    const divergenciasComprasDRE=compareProcurementDreRecognition(fonteFinanceira,events);
    const lastRun=[...runs].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null;

    const linkedLegacyKeys=new Set(legacyLinks.map(link=>`${String(link.legacy_type||"")}:${String(link.legacy_id||"")}`));
    const missingLegacyLinks=snapshot.facts
      .filter(fact=>!linkedLegacyKeys.has(`${String(fact.legacyType||"")}:${String(fact.legacyId||"")}`))
      .map(fact=>({legacyType:String(fact.legacyType||""),legacyId:String(fact.legacyId||"")}));
    const openFinancialQualityCases=qualityCases.filter(item=>
      item.status==="open"
      && /^(financial_|reconciliation_)/.test(String(item.category||""))
    );
    let staleLegacyLinks=[];
    let legacyHashesVerified=false;
    if(process.env.POSTGRES_URL_NON_POOLING){
      staleLegacyLinks=await comSql(sql=>findStaleFinancialLegacyLinks({
        sql,companyId:currentCompany(),facts:snapshot.facts,
      }));
      legacyHashesVerified=true;
    }
    const canonicalIntegrity=auditCanonicalFinancialIntegrity({
      titles,settlements,banks,reconciliationLinks,legacyLinks,accountingPeriods,
    });
    const bankDivergences=compareLegacyBankTransactions(snapshot.bankTransactions,banks);
    const activationGate=financialActivationEvidenceGate({
      factsCount:snapshot.facts.length,
      shadowRun:lastRun,
      ledgerComparisonVerified:true,
      divergences:divergencias,
      dreComparisonVerified:true,
      dreDivergences:divergenciasDRE,
      procurementDreComparisonVerified:true,
      procurementDreDivergences:divergenciasComprasDRE,
      legacyLinksVerified:true,
      missingLegacyLinks,
      legacyHashesVerified,
      staleLegacyLinks,
      bankComparisonVerified:true,
      bankDivergences,
      qualityCasesVerified:true,
      openQualityCases:openFinancialQualityCases,
      canonicalIntegrityVerified:true,
      canonicalIntegrity,
    });

    return {
      ok:true,modo:"sombra",engineEnforced:FINANCIAL_ENGINE_ENFORCE,
      legado,canonico,divergencias,divergenciasDRE,divergenciasComprasDRE,
      missingLegacyLinks,
      legacyHashesVerified,
      staleLegacyLinks,
      bankComparisonVerified:true,
      bankDivergences,
      canonicalIntegrity,
      activationGate,
      prontoParaAtivar:activationGate.ready,
      contagens:{
        fatosLegados:snapshot.facts.length,
        transacoesLegadas:snapshot.bankTransactions.length,
        titulos:titles.length,
        liquidacoes:settlements.filter(row=>row.status==="active").length,
        vinculosConciliacao:reconciliationLinks.filter(row=>row.status==="active").length,
        vinculosLegado:legacyLinks.length,
        vinculosLegadoAusentes:missingLegacyLinks.length,
        vinculosLegadoDesatualizados:staleLegacyLinks.length,
        hashesLegadoVerificados:legacyHashesVerified,
        divergenciasBancoLegado:bankDivergences.length,
        bancoLegadoVerificado:true,
        projecoesDRE:snapshot.dreSnapshots.length,
        divergenciasDRE:divergenciasDRE.length,
        divergenciasAbertas:openFinancialQualityCases.length,
        errosIntegridadeCanonica:canonicalIntegrity.counts.errors,
        avisosIntegridadeCanonica:canonicalIntegrity.counts.warnings,
      },
      ultimaCarga:lastRun,
    };
  };

  return relatorioSombraFinanceira;
}
