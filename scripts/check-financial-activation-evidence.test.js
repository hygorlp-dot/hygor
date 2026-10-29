import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — check explícito de ativação",()=>{
  const script=readFileSync("scripts/check-financial-activation-evidence.mjs","utf8");
  const pkg=JSON.parse(readFileSync("package.json","utf8"));

  it("fica disponível como comando explícito e fora do prebuild",()=>{
    expect(pkg.scripts["financial:activation-check"]).toBe("node scripts/check-financial-activation-evidence.mjs");
    expect(pkg.scripts.prebuild).not.toContain("financial:activation-check");
  });

  it("consulta todas as evidências do gate, inclusive o hash exato dos vínculos",()=>{
    for(const token of [
      "buildLegacyFinancialFacts",
      "mergeFinancialSourceRows",
      "rebuildArchivedLaborCosts",
      "ARCHIVED_LABOR_SOURCE_MISSING",
      "compareFinancialScopes",
      "compareDreProjectionRows",
      "compareProcurementDreRecognition",
      "auditCanonicalFinancialIntegrity",
      "compareLegacyBankTransactions",
      "bankComparisonVerified:true",
      "bankDivergences",
      "findStaleFinancialLegacyLinks",
      "financialActivationEvidenceGate",
      "legacyHashesVerified:true",
      "ledgerComparisonVerified:true",
      "dreComparisonVerified:true",
      "procurementDreComparisonVerified:true",
      "legacyLinksVerified:true",
      "qualityCasesVerified:true",
      "canonicalIntegrityVerified:true",
      "staleLegacyLinks",
      "missingLegacyLinks",
      "openQualityCases",
    ])expect(script).toContain(token);
  });

  it("exige conexão PostgreSQL direta para provar os hashes",()=>{
    expect(script).toContain("POSTGRES_URL_NON_POOLING");
    expect(script).toContain("é obrigatória para provar os hashes");
    expect(script).toContain("comSql");
    expect(script).toContain("fecharConexaoSql");
  });

  it("é somente leitura sobre Supabase e PostgreSQL",()=>{
    expect(script).toContain(".select(");
    expect(script).not.toMatch(/\.insert\s*\(/);
    expect(script).not.toMatch(/\.update\s*\(/);
    expect(script).not.toMatch(/\.upsert\s*\(/);
    expect(script).not.toMatch(/\.delete\s*\(/);
    expect(script).not.toMatch(/\.rpc\s*\(/);
    expect(script).not.toMatch(/\b(insert|update|delete|alter|drop|create)\s+(into|table|function|schema|from)\b/i);
  });

  it("falha fechado quando qualquer gate está vermelho",()=>{
    expect(script).toContain("if(!gate.ready)");
    expect(script).toContain("process.exitCode=1");
    expect(script).toContain("A ativação continua sendo uma decisão explícita de deploy");
  });
});
