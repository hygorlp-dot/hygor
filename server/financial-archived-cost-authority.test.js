import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — custo arquivado autoritativo no servidor",()=>{
  const api=readFileSync("api/data.js","utf8");
  const deploy=readFileSync("scripts/apply-financial-shadow.mjs","utf8");
  const source=readFileSync("server/financial-source-snapshot.js","utf8");

  it("fonte financeira compartilhada recompõe arquivos em modo estrito",()=>{
    expect(source).toContain("attachArchivedLaborCostsFromRows");
    expect(source).toContain("summarizeArchivedCosts");
    expect(source).toContain("normalizeArchivedCosts");
    expect(source).toContain('error.code="ARCHIVED_LABOR_SOURCE_MISSING"');
    expect(source).toContain("{strict:true}");
  });

  it("carga de produção passa pela mesma fonte financeira",()=>{
    expect(deploy).toContain("mergeFinancialSourceRows");
    expect(deploy).toContain("buildLegacyFinancialFacts(sourceData)");
  });

  it("relatório e sync de sombra usam custo recomposto",()=>{
    const reportStart=api.indexOf("const relatorioSombraFinanceira");
    const reportEnd=api.indexOf("// O ponto arquivado",reportStart);
    const report=api.slice(reportStart,reportEnd);
    expect(report).toContain("anexarCustosArquivados(atual,{strict:true})");
    expect(report).toContain("buildLegacyFinancialFacts(fonte)");
    expect(report).toContain("compareProcurementDreRecognition(fonte,events)");

    const syncStart=api.indexOf('if(action==="financial-shadow-sync")');
    const syncEnd=api.indexOf("// Fase 2",syncStart);
    const sync=api.slice(syncStart,syncEnd);
    expect(sync).toContain("fonteFinanceira=await anexarCustosArquivados(atual,{strict:true})");
    expect(sync).toContain("buildLegacyFinancialFacts(fonteFinanceira)");
    expect(sync).toContain("custosArquivadosAnexados:true");
  });

  it("prévia aberta usa custo arquivado autoritativo sem recalcular competência já fechada",()=>{
    const start=api.indexOf('if(action==="financial-closing-preview")');
    const end=api.indexOf("// Motor Financeiro Canônico:",start);
    const block=api.slice(start,end);
    expect(block).toContain("stored?.ok&&stored.alreadyClosed");
    expect(block).toContain("fonteFinanceira=await anexarCustosArquivados(atual,{strict:true})");
    expect(block.indexOf("stored?.ok&&stored.alreadyClosed"))
      .toBeLessThan(block.indexOf("anexarCustosArquivados(atual,{strict:true})"));
    expect(block).toContain("buildRequestedDreProjectionRows(fonteFinanceira");
    expect(block).toContain("data:fonteFinanceira");
  });

  it("DRE anual, mensal e gestão financeira usam fonte autoritativa",()=>{
    const annualStart=api.indexOf('if(action==="financial-annual-dre-report"');
    const dreEnd=api.indexOf('if(action==="backup-status")',annualStart);
    const block=api.slice(annualStart,dreEnd);
    expect(block.match(/anexarCustosArquivados\(atual,\{strict:true\}\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(block).toContain("buildRequestedDreProjectionRows(fonteFinanceira,requests,canonical.events)");
    expect(block).toContain("buildIntegratedDreManagement(fonteFinanceira,canonical)");
    expect(block).toContain("buildRequestedDreProjectionRows(fonteFinanceira,projectionRequests,canonical.events)");
  });

  it("fechamento trava arquivos de quinzena na mesma transação antes de calcular",()=>{
    const start=api.indexOf('if(command.type==="CLOSE_ACCOUNTING_PERIOD")');
    const end=api.indexOf('const {data:resultado,error}=await db.rpc("financial_execute_command"',start);
    const block=api.slice(start,end);
    expect(block).toContain("anexarCustosArquivadosNaTransacao");
    expect(block).toContain("key like");
    expect(block).toContain("__arq__%");
    expect(block).toContain("for update");
    expect(block.indexOf("anexarCustosArquivadosNaTransacao"))
      .toBeLessThan(block.indexOf("buildRequestedDreProjectionRows(closingData"));
  });

  it("arquivo ausente gera erro explícito e não cálculo parcial",()=>{
    expect(api).toContain('err?.code==="ARCHIVED_LABOR_SOURCE_MISSING"');
    expect(api).toContain("O cálculo financeiro foi bloqueado para evitar custo subestimado");
    expect(api).toContain("retryable:false");
  });
});
