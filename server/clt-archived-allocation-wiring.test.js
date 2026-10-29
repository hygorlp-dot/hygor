import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — wiring do arquivo CLT",()=>{
  const api=readFileSync("api/data.js","utf8");

  it("congela remuneração e histórico de obra no employeesSnapshot",()=>{
    const start=api.indexOf("const employeesSnapshot =");
    const end=api.indexOf("const agora =",start);
    const block=api.slice(start,end);
    expect(start).toBeGreaterThan(-1);
    for(const token of [
      "monthlySalary",
      "remunerationMode",
      "remunerationEffectiveFrom",
      "remunerationHistory",
      "obraHistory",
      "dailyRate",
      "vtDaily",
      "vrDaily",
    ])expect(block).toContain(token);
  });

  it("recomposição de arquivo antigo recebe employees atuais só como fallback",()=>{
    const source=readFileSync("server/financial-archived-costs-source.js","utf8");
    expect(source).toContain("summarizeArchivedCosts(decodeAppData(row.value),data?.config,data?.employees)");
    expect(api).toContain("rebuildArchivedLaborCosts({data:payload,archiveRows:linhas||[],key:KEY})");
  });

  it("resumo criado no arquivamento usa a fotografia completa congelada",()=>{
    const start=api.indexOf('if (action === "archive-quinzena")');
    const end=api.indexOf('if (action === "list-quinzena-archives")',start);
    const block=api.slice(start,end);
    expect(block).toContain("{ attendance: fatia, employeesSnapshot }");
    expect(block).toContain("atual?.employees||[]");
    expect(block).toContain("financialSnapshot:resumoFinanceiro");
  });
});
