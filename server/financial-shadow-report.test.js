import { afterEach, expect, it, vi } from "vitest";
import { runWithCompany } from "./company-context.js";
import { createFinancialShadowReport } from "./financial-shadow-report.js";

afterEach(() => vi.unstubAllEnvs());

it("recompõe a fonte antes de consultar as tabelas da empresa", async () => {
  vi.stubEnv("POSTGRES_URL_NON_POOLING", "");
  const calls = [];
  const db = {
    from(table) {
      return {select: () => ({eq: (field, company) => ({range: async (start, end) => {
        calls.push({table, field, company, start, end});
        return {data: [], error: null};
      }})})};
    },
  };
  const report = createFinancialShadowReport({
    db,
    engineEnforced: true,
    exigirCustosArquivados: async data => {
      calls.push("recompôs a fonte");
      return data;
    },
  });
  const result = await runWithCompany("mrc", () => report({}));
  expect(calls[0]).toBe("recompôs a fonte");
  expect(calls.slice(1).map(call => call.table)).toEqual([
    "financial_titles", "settlements", "financial_events", "bank_transactions",
    "reconciliation_links", "legacy_record_links", "accounting_periods",
    "data_quality_cases", "financial_shadow_runs",
  ]);
  for (const call of calls.slice(1)) {
    expect(call).toMatchObject({field: "company_id", company: "mrc", start: 0, end: 999});
  }
  expect(result).toMatchObject({
    ok: true, modo: "sombra", engineEnforced: true, legacyHashesVerified: false,
    bankComparisonVerified: true, prontoParaAtivar: false,
  });
});
