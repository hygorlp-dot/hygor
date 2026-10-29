import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — wiring atômico do fechamento mensal",()=>{
  const api=readFileSync("api/data.js","utf8");

  it("fecha o canônico e grava o snapshot dentro do mesmo transaction callback",()=>{
    const start=api.indexOf('if(command.type==="CLOSE_ACCOUNTING_PERIOD")');
    const end=api.indexOf('const {data:resultado,error}=await db.rpc("financial_execute_command"',start);
    const block=api.slice(start,end);
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain("executarMutacaoMultiLinha");
    expect(block).toContain("prepareMonthlyFinancialClosing");
    expect(block).toContain("pg_advisory_xact_lock");
    expect(block).toContain("financial-shadow-sync");
    expect(block.indexOf("pg_advisory_xact_lock"))
      .toBeLessThan(block.indexOf("select id,origin_type,obra_id"));
    expect(block).toContain("canonicalDreEvents");
    expect(block).toContain("buildRequestedDreProjectionRows");
    expect(block).toContain("requireCanonicalDre:true");
    expect(block).toContain("canonicalDreSnapshot");
    expect(block).toContain("select financial_execute_command(");
    expect(block).toContain("transaction.json(command)");
    expect(block).not.toContain('db.rpc("financial_execute_command"');
  });

  it("trava todos os domínios de DRE mas escreve somente a core",()=>{
    const start=api.indexOf('if(command.type==="CLOSE_ACCOUNTING_PERIOD")');
    const block=api.slice(start,start+9000);
    expect(block).toContain("domains:[DOMAIN_ROW.CORE,...SPLITTABLE_DOMAINS]");
    expect(block).toContain("writeDomains:[DOMAIN_ROW.CORE]");
    expect(block).toContain("key like");
    expect(block).toContain("PONTO_OBRA_KEY_PREFIX");
    expect(block).toContain("for update");
    expect(block).toContain("mergeAttendanceObjects");
  });

  it("o helper distingue domínio travado de domínio gravado sem mudar o default",()=>{
    expect(api).toContain("writeDomains=domains");
    expect(api).toContain("separadosGravaveis");
    expect(api).toContain("if(!separadosGravaveis.has(dominio))continue");
    expect(api).toContain("separadosGravaveis.has(d)?\"criando\":linha.rowVersions?.[d]||null");
  });

  it("bloqueia fechamento se um título canônico não tiver classificação de DRE",()=>{
    const start=api.indexOf('if(command.type==="CLOSE_ACCOUNTING_PERIOD")');
    const block=api.slice(start,start+12000);
    expect(block).toContain("canonical.issues.length");
    expect(block).toContain("títulos canônicos sem classificação suficiente");
    expect(block).toContain("canonicalIssues");
  });

  it("falha fechado se não houver conexão transacional",()=>{
    const start=api.indexOf('if(command.type==="CLOSE_ACCOUNTING_PERIOD")');
    const block=api.slice(start,start+2500);
    expect(block).toContain("FINANCIAL_CLOSING_TRANSACTION_REQUIRED");
    expect(block).toContain("Nenhum fechamento foi salvo");
  });
});
