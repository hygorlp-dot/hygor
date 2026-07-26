import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const app = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("layout mobile do login", () => {
  it("usa grade natural e safe areas, sem reserva fixa de conteúdo", () => {
    expect(css).toContain("grid-template-rows: 13rem auto");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain(".login-access-column {\n    display: flex;\n    grid-column: 1;");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).not.toContain("padding: 178px 16px 24px");
  });

  it("mantém somente vídeo e caixa de acesso, sem painel lateral cinza", () => {
    expect(css).toContain("--login-media-end: 100%");
    expect(css).toContain("justify-content: flex-start;");
    expect(css).toContain("background: transparent;");
    expect(css).toContain(".login-project-story {\n  display: none;");
  });

  it("tem adaptação de landscape e alvo de toque para senha", () => {
    expect(css).toContain("orientation: landscape");
    expect(css).toContain(".login-password-toggle");
    expect(app).toContain("login-password-toggle");
  });
});
