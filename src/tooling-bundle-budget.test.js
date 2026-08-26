import { describe, expect, it } from "vitest";
import { evaluateBundleBudgets } from "../scripts/bundle-budgets.mjs";

describe("orçamento interno de bundle", () => {
  it("aceita a linha de base dos chunks atuais", () => {
    const result = evaluateBundleBudgets({
      totals: { gzipBytes: 1_044.02 * 1024 },
      assets: [
        { name: "LegacyApp-hash.js", gzipBytes: 530.03 * 1024 },
        { name: "spreadsheet-tools-hash.js", gzipBytes: 249.66 * 1024 },
        { name: "charts-hash.js", gzipBytes: 104.12 * 1024 },
        { name: "vendor-hash.js", gzipBytes: 85.1 * 1024 },
        { name: "ClientPortalApp-hash.js", gzipBytes: 4.85 * 1024 },
      ],
    });

    expect(result.violations).toEqual([]);
  });

  it("reprova um novo chunk que ultrapassa o orçamento isolado", () => {
    const result = evaluateBundleBudgets({
      totals: { gzipBytes: 100 * 1024 },
      assets: [{ name: "new-feature-hash.js", gzipBytes: 201 * 1024 }],
    });

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain("new-feature-hash.js");
  });

  it("reprova mídia estática que ultrapassa o limite do login", () => {
    const result = evaluateBundleBudgets({
      totals: { gzipBytes: 100 * 1024 },
      assets: [],
      media: [{ name: "login-background-hash.webm", bytes: 3.1 * 1024 * 1024 }],
    });

    expect(result.violations).toContainEqual(expect.stringContaining("login-background-hash.webm"));
  });
});
