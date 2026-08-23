import { describe, expect, it } from "vitest";
import {
  CORE_REGISTRY_TABLES, formatCoreRegistryShadowStatus, summarizeCoreRegistryShadowStatus,
} from "./core-registry-shadow-status.js";

const run = (result, createdAt = "2026-08-22T10:00:00.000Z", actorId = "system:production-deploy") => ({
  result, created_at: createdAt, actor_id: actorId,
});

const fullResult = (overrides = {}) => ({
  projects: 3, employees: 10, employeeAssignments: 9, employeeIdentifiers: 12,
  suppliers: 5, thirdPartyProfiles: 4, thirdPartyContracts: 4,
  ...overrides,
});

describe("summarizeCoreRegistryShadowStatus", () => {
  it("sinaliza ausência total de histórico quando core_registry_shadow_runs está vazia", () => {
    const summary = summarizeCoreRegistryShadowStatus({ runs: [], liveCounts: {} });
    expect(summary.hasRuns).toBe(false);
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatch(/nunca rodou/);
  });

  it("não gera alerta quando a contagem da última sincronização bate com as tabelas ao vivo", () => {
    const liveCounts = fullResult();
    const summary = summarizeCoreRegistryShadowStatus({
      runs: [run(fullResult())],
      liveCounts,
    });
    expect(summary.hasRuns).toBe(true);
    expect(summary.warnings).toEqual([]);
  });

  it("alerta quando a contagem registrada diverge das linhas ativas atuais", () => {
    const summary = summarizeCoreRegistryShadowStatus({
      runs: [run(fullResult({ employees: 10 }))],
      liveCounts: fullResult({ employees: 7 }),
    });
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatch(/employees.*10.*core_employees tem 7/);
  });

  it("alerta quando uma seção caiu para zero em relação à sincronização anterior", () => {
    const summary = summarizeCoreRegistryShadowStatus({
      runs: [
        run(fullResult({ suppliers: 0 }), "2026-08-22T12:00:00.000Z"),
        run(fullResult({ suppliers: 6 }), "2026-08-21T12:00:00.000Z"),
      ],
      liveCounts: fullResult({ suppliers: 0 }),
    });
    expect(summary.warnings.some(w => /suppliers.*caiu de 6 para 0/.test(w))).toBe(true);
  });

  it("calcula a idade da última sincronização em milissegundos", () => {
    const summary = summarizeCoreRegistryShadowStatus({
      runs: [run(fullResult(), new Date(Date.now() - 3600_000).toISOString())],
      liveCounts: fullResult(),
    });
    expect(summary.ageMs).toBeGreaterThanOrEqual(3600_000 - 1000);
    expect(summary.ageMs).toBeLessThan(3600_000 + 60_000);
  });
});

describe("formatCoreRegistryShadowStatus", () => {
  it("formata a ausência de histórico com uma linha de alerta", () => {
    const lines = formatCoreRegistryShadowStatus({ hasRuns: false, warnings: ["nunca rodou"] });
    expect(lines[0]).toMatch(/SEM HISTÓRICO/);
    expect(lines[1]).toMatch(/nunca rodou/);
  });

  it("formata um status limpo, sem alertas, listando todas as 7 tabelas", () => {
    const summary = summarizeCoreRegistryShadowStatus({
      runs: [run(fullResult())],
      liveCounts: fullResult(),
    });
    const lines = formatCoreRegistryShadowStatus(summary);
    expect(lines[0]).toMatch(/última sincronização/);
    Object.values(CORE_REGISTRY_TABLES).forEach(table => {
      expect(lines.some(line => line.includes(table))).toBe(true);
    });
    expect(lines.at(-1)).toMatch(/0 divergência/);
  });

  it("formata alertas quando existem", () => {
    const summary = summarizeCoreRegistryShadowStatus({
      runs: [run(fullResult({ employees: 10 }))],
      liveCounts: fullResult({ employees: 3 }),
    });
    const lines = formatCoreRegistryShadowStatus(summary);
    expect(lines.some(line => line.includes("1 alerta"))).toBe(true);
    expect(lines.some(line => line.startsWith("  ! "))).toBe(true);
  });
});
