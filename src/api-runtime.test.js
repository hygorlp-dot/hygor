import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "rolldown/utils";
import { describe, expect, it } from "vitest";

describe("runtime ESM das APIs", () => {
  it("declara ESM e mantém a função de dados sintaticamente carregável", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    const filename = resolve(process.cwd(), "api/data.js");
    const source = readFileSync(filename, "utf8");
    const parsed = parseSync(filename, source);
    expect(pkg.type).toBe("module");
    expect(parsed.errors).toEqual([]);
    expect(parsed.module).toBeDefined();
  });
});
