import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = path => readFileSync(resolve(process.cwd(), path), "utf8");
const html = read("index.html");
const css = read("src/index.css");
const primitives = read("src/design-system/primitives/styles.css");
const typography = read("src/design-system/tokens/typography.css");
const app = read("src/LegacyApp.jsx");

describe("fundações responsivas", () => {
  it("configura viewport com safe area e não mascara estouro global", () => {
    expect(html).toContain('content="width=device-width, initial-scale=1, viewport-fit=cover"');
    expect(app).not.toContain("html,body{max-width:100%;overflow-x:hidden}");
    expect(app).toContain("body{min-width:320px}");
  });

  it("preserva controles legíveis e modais de tela inteira no celular", () => {
    expect(css).toContain("font-size: var(--arcd-type-control-touch) !important");
    expect(typography).toContain("--arcd-type-control-touch: 1rem;");
    expect(css).toContain("height: 100dvh");
    expect(primitives).toContain(".arcd-input, .arcd-select, .arcd-textarea { font-size: var(--arcd-type-control-touch); }");
    expect(primitives).toContain(".arcd-dialog { display: flex; width: 100%; max-width: none; height: 100dvh;");
  });

  it("usa navegação compacta e diálogo acessível no app operacional", () => {
    expect(app).toContain("<LazyLegacyMobileNavigation");
    expect(app).toContain('role="dialog"');
    expect(app).toContain('aria-modal="true"');
    expect(app).toContain('event.key === "Escape"');
  });
});
