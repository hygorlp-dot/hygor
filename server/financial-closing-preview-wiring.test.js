import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — prévia do fechamento mensal",()=>{
  const api=readFileSync("api/data.js","utf8");
  const client=readFileSync("src/api.js","utf8");

  it("expõe ação admin-only de prévia baseada no DRE canônico",()=>{
    const start=api.indexOf('if(action==="financial-closing-preview")');
    const end=api.indexOf('// Motor Financeiro Canônico:',start);
    const block=api.slice(start,end);
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('usuario.role!=="admin"');
    expect(block).toContain("loadCanonicalDre");
    expect(block).toContain("buildRequestedDreProjectionRows");
    expect(block).toContain("previewMonthlyFinancialClosing");
    expect(block).toContain("canonicalDreSnapshot");
    expect(block).toContain("sourceRevision");
  });

  it("competência já fechada é lida do snapshot antes de consultar o razão vivo",()=>{
    const start=api.indexOf('if(action==="financial-closing-preview")');
    const end=api.indexOf('// Motor Financeiro Canônico:',start);
    const block=api.slice(start,end);
    expect(block).toContain("stored?.ok&&stored.alreadyClosed");
    expect(block).toContain('source:"closed_snapshot"');
    expect(block.indexOf("stored?.ok&&stored.alreadyClosed"))
      .toBeLessThan(block.indexOf("loadCanonicalDre"));
  });

  it("não executa comando, migration ou escrita durante a prévia",()=>{
    const start=api.indexOf('if(action==="financial-closing-preview")');
    const end=api.indexOf('// Motor Financeiro Canônico:',start);
    const block=api.slice(start,end);
    expect(block).not.toContain("financial_execute_command");
    expect(block).not.toContain("executarMutacaoMultiLinha");
    expect(block).not.toContain("financial_sync_legacy_facts");
    expect(block).not.toMatch(/\.insert\s*\(/);
    expect(block).not.toMatch(/\.update\s*\(/);
    expect(block).not.toMatch(/\.upsert\s*\(/);
    expect(block).not.toMatch(/\.delete\s*\(/);
  });

  it("cliente envia apenas intervalo da competência e credenciais",()=>{
    expect(client).toContain("consultarPreviaFechamentoFinanceiro");
    expect(client).toContain('action:"financial-closing-preview"');
    expect(client).toContain("startsOn, endsOn");
  });
});
