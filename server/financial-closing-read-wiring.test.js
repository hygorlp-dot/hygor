import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — DRE fechado usa fotografia imutável",()=>{
  const api=readFileSync("api/data.js","utf8");

  it("DRE anual sobrepõe competências fechadas",()=>{
    const start=api.indexOf('if(action==="financial-annual-dre-report"');
    const end=api.indexOf('if(action==="financial-management-report")',start);
    const block=api.slice(start,end);
    expect(block).toContain("overlayClosedCompanyDreYear");
    expect(block).toContain("closedCompanyDreEntries");
    expect(block).toContain("closedCompetences");
    expect(block).toContain("canonical_ledger_with_closed_snapshots");
  });

  it("DRE empresarial mensal não rematerializa a competência fechada",()=>{
    const start=api.indexOf('if(action==="financial-dre-report"||action==="financial-company-dre-report")');
    const end=api.indexOf('if(action==="backup-status")',start);
    const block=api.slice(start,end);
    expect(block).toContain("frozenCurrent");
    expect(block).toContain("!frozenCurrent&&(");
    expect(block).toContain('source:frozenCurrent?"closed_snapshot":"canonical_ledger"');
    expect(block).toContain("frozenById.get(sourceId)?.payload");
  });

  it("histórico fechado substitui evento vivo sem afetar meses abertos",()=>{
    const start=api.indexOf('if(action==="financial-dre-report"||action==="financial-company-dre-report")');
    const end=api.indexOf('if(action==="backup-status")',start);
    const block=api.slice(start,end);
    expect(block).toContain("return !frozenById.has(sourceId)");
    expect(block).toContain("frozenById.get(sourceId)?.payload||byId.get(sourceId)||null");
  });

  it("escopo por obra não usa snapshot consolidado da empresa",()=>{
    const start=api.indexOf('if(action==="financial-dre-report"||action==="financial-company-dre-report")');
    const end=api.indexOf('if(action==="backup-status")',start);
    const block=api.slice(start,end);
    expect(block).toContain("companyStatement?closedCompanyDreBySourceId(atual):new Map()");
    expect(block).toContain('companyStatement&&period==="mes"?closedCompanyDreFor(atual,year,month):null');
  });
});
