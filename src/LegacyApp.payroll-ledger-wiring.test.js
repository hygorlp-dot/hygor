import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("persistência transacional da folha conciliada", () => {
  it("não mantém escritores de pagamentos ou títulos de folha no LegacyApp", () => {
    expect(source).toContain("pagamentosFolha:");
    expect(source).toContain("titulosFolha:");
    expect(source).not.toMatch(/update\s*\([^)]*pagamentosFolha/s);
    expect(source).not.toMatch(/update\s*\([^)]*titulosFolha/s);
  });
});
