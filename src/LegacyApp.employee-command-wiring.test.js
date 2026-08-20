import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");
// Folha foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-16 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #8) - o
// cálculo do desconto de adiantamento agora mora aqui, não em `source`.
const folhaSource = readFileSync(resolve(process.cwd(), "src/domains/ponto/components/FolhaView.jsx"), "utf8");
// Equipe foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-20 - o cadastro de funcionário e o registro/cancelamento de
// adiantamento (a partir da tela Equipe) agora moram aqui, não em `source`.
const equipeSource = readFileSync(resolve(process.cwd(), "src/domains/rh/components/EquipeView.jsx"), "utf8");

describe("persistência transacional dos funcionários", () => {
  it("não mantém escritor de employees pelo snapshot legado", () => {
    expect(equipeSource).toContain("OPERATIONAL_COMMAND.EMPLOYEE_SAVED");
    const total = (source.match(/OPERATIONAL_COMMAND\.EMPLOYEE_SAVED/g)?.length || 0)
      + (equipeSource.match(/OPERATIONAL_COMMAND\.EMPLOYEE_SAVED/g)?.length || 0);
    expect(total).toBeGreaterThanOrEqual(7);
    expect(source).not.toMatch(/update\s*\(\s*\{[^}]*employees\s*:/s);
    expect(equipeSource).not.toMatch(/update\s*\(\s*\{[^}]*employees\s*:/s);
  });

  it("registra e cancela adiantamentos pelo comando versionado",()=>{
    expect(equipeSource).toContain("OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CREATED");
    expect(equipeSource).toContain("OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CANCELLED");
    expect(equipeSource).not.toMatch(/update\s*\(\s*\{[^}]*advances\s*:/s);
    expect(folhaSource).toContain("advanceDeductionForPeriod(advance,periIni,periFim)");
  });
});
