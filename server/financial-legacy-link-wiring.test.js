import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — prova exata dos legacy_record_links",()=>{
  const report=readFileSync("server/financial-shadow-report.js","utf8");

  it("relatório de sombra usa PostgreSQL para comparar o hash atual",()=>{
    const block=report.slice(report.indexOf("const relatorioSombraFinanceira"));
    expect(block).toContain("findStaleFinancialLegacyLinks");
    expect(block).toContain("POSTGRES_URL_NON_POOLING");
    expect(block).toContain("comSql");
    expect(block).toContain("legacyHashesVerified=true");
    expect(block).toContain("staleLegacyLinks");
  });

  it("gate recebe separadamente ausência de vínculo e vínculo desatualizado",()=>{
    const block=report.slice(report.indexOf("const relatorioSombraFinanceira"));
    expect(block).toContain("missingLegacyLinks");
    expect(block).toContain("legacyHashesVerified");
    expect(block).toContain("staleLegacyLinks");
    expect(block).toContain("vinculosLegadoDesatualizados");
  });
});
