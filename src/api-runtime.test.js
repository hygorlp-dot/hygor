import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("runtime ESM das APIs", () => {
  it("declara ESM e mantém a função de dados sintaticamente carregável", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    expect(pkg.type).toBe("module");
    expect(() => execFileSync(process.execPath, ["--check", "api/data.js"], { cwd: process.cwd(), stdio: "pipe" })).not.toThrow();
  });
});
