import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
// Orçamento foi extraído de LegacyApp.jsx em 2026-08-16 (ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #1) - o JSX do editor
// agora mora aqui.
const app = readFileSync(resolve(process.cwd(), "src/domains/orcamentos/components/OrcamentoView.jsx"), "utf8");

describe("densidade do editor de orçamento", () => {
  it("compacta somente as linhas editáveis no desktop", () => {
    expect(app).toContain('className="budget-line-row"');
    expect(css).toContain(".arcd-main .budget-line-row input");
    expect(css).toContain("min-height: 30px");
    expect(css).toContain("font-size: 10px !important");
  });

  it("preserva o padrão global de toque no mobile", () => {
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("font-size: 16px !important");
  });
});
