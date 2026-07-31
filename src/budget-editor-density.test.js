import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const app = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

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
