import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Rescisao foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-20 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md) - a tela
// canônica agora mora lá, não em src/LegacyApp.jsx.
const component = readFileSync(
  resolve(process.cwd(), "src/domains/rh/components/RescisaoView.jsx"),
  "utf8",
);

describe("ligação transacional da rescisão", () => {
  it("usa o cálculo compartilhado e não grava rescisoes por snapshot", () => {
    expect(component).toContain('calculateRescission');
    expect(component).toContain('OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CREATED');
    expect(component).toContain('OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CANCELLED');
    expect(component).not.toMatch(/update\s*\(\s*\{[^)]*rescisoes/s);
  });
});
