import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("persistência transacional dos funcionários", () => {
  it("não mantém escritor de employees pelo snapshot legado", () => {
    expect(source).toContain("OPERATIONAL_COMMAND.EMPLOYEE_SAVED");
    expect(source.match(/OPERATIONAL_COMMAND\.EMPLOYEE_SAVED/g)?.length || 0)
      .toBeGreaterThanOrEqual(7);
    expect(source).not.toMatch(/update\s*\(\s*\{[^}]*employees\s*:/s);
  });
});
