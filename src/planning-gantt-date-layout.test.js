import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Planejamento foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-16 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #5).
const app = readFileSync(resolve(process.cwd(), "src/domains/planejamento/components/PlanejamentoView.jsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("enquadramento das datas do cronograma", () => {
  it("separa semanticamente início e fim na grade do Gantt", () => {
    expect(app).toContain("planning-gantt-date-cell--start");
    expect(app).toContain("planning-gantt-date-cell--end");
    expect(app).toContain("planning-gantt-header-cell--date");
    expect(app).toContain('const ALTURA_LINHA = isDesktop ? 40 : 48');
  });

  it("mantém os campos dentro da coluna com foco e toque acessíveis", () => {
    expect(css).toMatch(/\.planning-gantt-date-cell\s*\{[\s\S]*?padding:\s*4px 6px;/);
    expect(css).toMatch(/\.arcd-main \.planning-inline-date\s*\{[\s\S]*?box-sizing:\s*border-box;/);
    expect(css).toMatch(/\.arcd-main \.planning-inline-date\s*\{[\s\S]*?min-height:\s*30px !important;/);
    expect(css).toMatch(/@media\s*\(max-width:\s*700px\)[\s\S]*?\.arcd-main \.planning-inline-date\s*\{[\s\S]*?min-height:\s*44px !important;/);
  });
});
