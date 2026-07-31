import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("ligação transacional da rescisão", () => {
  it("usa o cálculo compartilhado e não grava rescisoes por snapshot", () => {
    expect(source).toContain('calculateRescission');
    expect(source).toContain('OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CREATED');
    expect(source).toContain('OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CANCELLED');
    const component = source.slice(
      source.indexOf("function Rescisao("),
      source.indexOf("function IntegracaoGemini("),
    );
    expect(component).not.toMatch(/update\s*\(\s*\{[^)]*rescisoes/s);
  });
});
