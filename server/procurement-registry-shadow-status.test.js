import { describe, expect, it } from "vitest";
import {
  PROCUREMENT_REGISTRY_TABLES, formatProcurementRegistryShadowStatus, summarizeProcurementRegistryShadowStatus,
} from "./procurement-registry-shadow-status.js";

const run = (result, createdAt = "2026-08-24T10:00:00.000Z", actorId = "system:production-deploy") => ({
  result, created_at: createdAt, actor_id: actorId,
});

const fullResult = (overrides = {}) => ({
  quotations: 5, purchaseOrders: 3,
  ...overrides,
});

describe("summarizeProcurementRegistryShadowStatus", () => {
  it("sinaliza ausência total de histórico quando procurement_registry_shadow_runs está vazia", () => {
    const summary = summarizeProcurementRegistryShadowStatus({ runs: [], liveCounts: {} });
    expect(summary.hasRuns).toBe(false);
    expect(summary.warnings[0]).toMatch(/nunca rodou/);
  });

  it("não gera alerta quando a contagem da última sincronização bate com as tabelas ao vivo", () => {
    const summary = summarizeProcurementRegistryShadowStatus({
      runs: [run(fullResult())], liveCounts: fullResult(),
    });
    expect(summary.hasRuns).toBe(true);
    expect(summary.warnings).toEqual([]);
  });

  it("alerta quando a contagem registrada diverge das linhas ativas atuais", () => {
    const summary = summarizeProcurementRegistryShadowStatus({
      runs: [run(fullResult({ quotations: 5 }))],
      liveCounts: fullResult({ quotations: 2 }),
    });
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatch(/quotations.*5.*core_quotations tem 2/);
  });
});

describe("formatProcurementRegistryShadowStatus", () => {
  it("formata um status limpo, sem alertas, listando as 2 tabelas", () => {
    const summary = summarizeProcurementRegistryShadowStatus({
      runs: [run(fullResult())], liveCounts: fullResult(),
    });
    const lines = formatProcurementRegistryShadowStatus(summary);
    Object.values(PROCUREMENT_REGISTRY_TABLES).forEach(table => {
      expect(lines.some(line => line.includes(table))).toBe(true);
    });
    expect(lines.at(-1)).toMatch(/0 divergência/);
  });
});
