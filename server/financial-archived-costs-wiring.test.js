import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — arquivos de ponto são fonte financeira autoritativa",()=>{
  const api=readFileSync("api/data.js","utf8");

  const between=(startNeedle,endNeedle)=>{
    const start=api.indexOf(startNeedle);
    const end=api.indexOf(endNeedle,start+startNeedle.length);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return api.slice(start,end);
  };

  it("bump da projeção invalida snapshots antigos gerados com cache arquivado",()=>{
    expect(api).toContain('DRE_PROJECTION_VERSION = "2026-10-custos-arquivados-autoritativos-v8"');
  });

  it("relatório e carga de sombra recompõem arquivos antes do snapshot",()=>{
    const report=between(
      "const relatorioSombraFinanceira = async atual =>",
      "// O ponto arquivado sai do dataset principal",
    );
    expect(report).toContain("fonteFinanceira=await exigirCustosArquivados(atual)");
    expect(report.indexOf("exigirCustosArquivados"))
      .toBeLessThan(report.indexOf("buildLegacyFinancialFacts(fonteFinanceira)"));
    expect(report).toContain("compareProcurementDreRecognition(fonteFinanceira,events)");

    const sync=between(
      'if(action==="financial-shadow-sync")',
      "// Fase 2, primeiro consumidor real do CORE-001",
    );
    expect(sync).toContain("fonteFinanceira=await exigirCustosArquivados(atual)");
    expect(sync).toContain("buildLegacyFinancialFacts(fonteFinanceira)");
  });

  it("DRE anual, gestão e DRE mensal usam fonte recomposta",()=>{
    const annual=between(
      'if(action==="financial-annual-dre-report"||action==="financial-annual-dre-layout")',
      'if(action==="financial-management-report")',
    );
    expect(annual).toContain("fonteFinanceira=await exigirCustosArquivados(atual)");
    expect(annual).toContain("buildRequestedDreProjectionRows(fonteFinanceira");

    const management=between(
      'if(action==="financial-management-report")',
      'if(action==="financial-dre-report"||action==="financial-company-dre-report")',
    );
    expect(management).toContain("buildIntegratedDreManagement(fonteFinanceira,canonical)");

    const dre=between(
      'if(action==="financial-dre-report"||action==="financial-company-dre-report")',
      'if(action==="backup-status")',
    );
    expect(dre).toContain("fonteFinanceira=await exigirCustosArquivados(atual)");
    expect(dre).toContain("buildRequestedDreProjectionRows(fonteFinanceira");
  });

  it("prévia fechada continua histórica; prévia aberta exige arquivos imutáveis",()=>{
    const preview=between(
      'if(action==="financial-closing-preview")',
      "// Motor Financeiro Canônico:",
    );
    const closed=preview.indexOf("stored?.ok&&stored.alreadyClosed");
    const rebuild=preview.indexOf("fonteFinanceira=await exigirCustosArquivados(atual)");
    expect(closed).toBeGreaterThan(-1);
    expect(rebuild).toBeGreaterThan(closed);
    expect(preview).toContain("buildRequestedDreProjectionRows(fonteFinanceira");
    expect(preview).toContain("data:fonteFinanceira");
  });

  it("fechamento recompõe arquivos dentro da mesma transação e falha fechado se faltar fonte",()=>{
    const closing=between(
      'if(command.type==="CLOSE_ACCOUNTING_PERIOD")',
      'const {data:resultado,error}=await db.rpc("financial_execute_command"',
    );
    expect(closing).toContain("carregarCustosArquivadosNaTransacao(transaction,closingDataBase)");
    expect(closing).toContain('code:"ARCHIVED_LABOR_SOURCE_MISSING"');
    expect(closing).toContain("missingArchivedPeriods:archived.missing");
    expect(closing.indexOf("carregarCustosArquivadosNaTransacao"))
      .toBeLessThan(closing.indexOf("canonicalDreEvents"));
    expect(closing).toContain("const closingData=archived.data");
  });

  it("replay de fechamento é resolvido antes de exigir arquivos históricos",()=>{
    const closing=between(
      'if(command.type==="CLOSE_ACCOUNTING_PERIOD")',
      'const {data:resultado,error}=await db.rpc("financial_execute_command"',
    );
    expect(closing.indexOf("replayProbe"))
      .toBeLessThan(closing.indexOf("carregarCustosArquivadosNaTransacao"));
  });

  it("arquivo ausente recebe erro operacional explícito, não 500 genérico",()=>{
    expect(api).toContain('err?.code==="ARCHIVED_LABOR_SOURCE_MISSING"');
    expect(api).toContain("missingArchivedPeriods:Array.isArray(err.missing)?err.missing:[]");
  });
});
