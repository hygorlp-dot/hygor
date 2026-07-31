import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("persistência transacional da configuração da empresa", () => {
  it("não mantém escritor de config pelo snapshot legado", () => {
    expect(source).toContain("OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED");
    expect(source).not.toMatch(/update\s*\(\s*\{[^}]*config\s*:/s);
  });
});
