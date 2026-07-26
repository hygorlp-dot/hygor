import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const rules = require("../.dependency-cruiser.cjs");

describe("guarda de fronteiras arquiteturais", () => {
  it("mantém somente as quatro fronteiras aprovadas para a POC", () => {
    expect(rules.forbidden.map(rule => rule.name)).toEqual([
      "client-portal-must-not-import-legacy-app",
      "design-system-must-not-import-domains",
      "api-must-not-import-react-ui",
      "browser-src-must-not-import-postgres",
    ]);
    expect(rules.forbidden.every(rule => rule.severity === "error")).toBe(true);
  });

  it("mantém o diagnóstico Knip restrito à aplicação ARCD", () => {
    const knip = JSON.parse(readFileSync(resolve(process.cwd(), "knip.json"), "utf8"));
    expect(knip.project).toContain("src/**/*.{js,jsx}");
    expect(knip.project).toContain("api/**/*.js");
    expect(knip.ignore).toEqual(expect.arrayContaining([
      ".agents/**",
      ".claude/**",
      ".claude-flow/**",
      "whatsapp-test/**",
    ]));
  });
});
