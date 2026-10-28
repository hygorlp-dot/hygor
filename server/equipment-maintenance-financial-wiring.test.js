import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — cancelamento de manutenção e DRE",()=>{
  const api=readFileSync("api/data.js","utf8");
  const persistence=readFileSync("server/operational-command-persistence.js","utf8");
  const calculations=readFileSync("src/domains/equipamentos/calculations.js","utf8");

  it("o comando de cancelamento participa do conjunto financeiro protegido",()=>{
    const start=api.indexOf("const FINANCIAL_OPERATIONAL_COMMANDS=new Set([");
    const end=api.indexOf("]);",start);
    const block=api.slice(start,end);
    expect(block).toContain("EQUIPMENT_MAINTENANCE_SAVED");
    expect(block).toContain("EQUIPMENT_MAINTENANCE_CANCELLED");
  });

  it("continua audit-only porque não cria título nem movimenta banco",()=>{
    const start=persistence.indexOf("const AUDIT_ONLY_EQUIPMENT_COMMANDS=new Set([");
    const end=persistence.indexOf("]);",start);
    const block=persistence.slice(start,end);
    expect(block).toContain("EQUIPMENT_MAINTENANCE_CANCELLED");
  });

  it("o cálculo financeiro exclui registros cancelados",()=>{
    expect(calculations).toContain('m.status!=="cancelada"');
  });
});
