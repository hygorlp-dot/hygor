import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseSync } from "rolldown/utils";
import { describe, expect, it } from "vitest";

describe("runtime ESM das APIs", () => {
  const apiFiles = directory => readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
    const filename=join(directory,entry.name);
    return entry.isDirectory() ? apiFiles(filename) : entry.name.endsWith(".js") ? [filename] : [];
  });

  it("declara ESM e mantém a função de dados sintaticamente carregável", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    const filename = resolve(process.cwd(), "api/data.js");
    const source = readFileSync(filename, "utf8");
    const parsed = parseSync(filename, source);
    expect(pkg.type).toBe("module");
    expect(parsed.errors).toEqual([]);
    expect(parsed.module).toBeDefined();
  });

  it("invalida projeções antigas do DRE quando a regra de cálculo evolui", () => {
    const source = readFileSync(resolve(process.cwd(), "api/data.js"), "utf8");
    expect(source).toContain("const DRE_PROJECTION_VERSION =");
    expect(source).toContain("currentEvent.payload?.projectionVersion");
    expect(source).toContain("projectionVersion:DRE_PROJECTION_VERSION");
  });

  it("consolida as rotas do portal sem alterar as URLs públicas", () => {
    const filename = resolve(process.cwd(), "api/client.js");
    const source = readFileSync(filename, "utf8");
    const parsed = parseSync(filename, source);
    expect(parsed.errors).toEqual([]);
    ["route[0]===\"auth\"", "route[1]===\"login\"", "route[1]===\"session\"", "route[1]===\"logout\"", "route[0]===\"projects\"", "route[2]===\"dashboard\""].forEach(route => expect(source).toContain(route));
  });

  it("mantém o número de funções serverless dentro do limite do plano Hobby", () => {
    const functions=apiFiles(resolve(process.cwd(),"api")).filter(filename => readFileSync(filename,"utf8").includes("export default"));
    expect(functions).toHaveLength(11);
    expect(functions.length).toBeLessThanOrEqual(12);
  });
});
