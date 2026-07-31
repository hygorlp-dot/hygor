import { describe, expect, it } from "vitest";
import { ARCD_TOKEN_NAMESPACE } from "./index.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("tokens do design system ARCD", () => {
  it("expõe o ponto de entrada de tokens", () => {
    expect(ARCD_TOKEN_NAMESPACE).toBe("arcd");
  });

  it("reúne tokens primitivos, semânticos, de densidade e contexto", () => {
    const source = readFileSync(resolve(process.cwd(), "src/design-system/tokens/index.css"), "utf8");
    expect(source).toContain('"./primitives.css"');
    expect(source).toContain('"./semantic.css"');
    expect(source).toContain('"./density.css"');
    expect(source).toContain('"../themes/carbon.css"');
    expect(source).toContain('"../themes/print.css"');
    expect(source).toContain('"./breakpoints.css"');
    expect(source).toContain('"./touch.css"');
    expect(source).toContain('"./safe-area.css"');
    expect(source).toContain('"./viewport.css"');
  });

  it("mantém um raio próprio e consistente para campos editáveis",()=>{
    const source=readFileSync(resolve(process.cwd(),"src/design-system/tokens/radius.css"),"utf8");
    expect(source).toContain("--arcd-radius-control: 0.5rem");
  });

  it("expõe a escala tipográfica e de ícones adotada pelo dashboard",()=>{
    const source=readFileSync(resolve(process.cwd(),"src/design-system/tokens/typography.css"),"utf8");
    ["--arcd-type-page-title","--arcd-type-section-title","--arcd-type-card-title","--arcd-type-body","--arcd-type-label","--arcd-type-caption","--arcd-type-kpi","--arcd-icon-size-sm","--arcd-icon-size-md","--arcd-icon-size-lg"].forEach(token=>expect(source).toContain(token));
  });
});
