import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_REGISTRY_TABLES, formatEquipmentRegistryShadowStatus, summarizeEquipmentRegistryShadowStatus,
} from "./equipment-registry-shadow-status.js";

const run = (result, createdAt = "2026-08-24T10:00:00.000Z", actorId = "system:production-deploy") => ({
  result, created_at: createdAt, actor_id: actorId,
});

const fullResult = (overrides = {}) => ({
  equipment: 4, owners: 2, allocations: 3, maintenanceEvents: 1,
  ...overrides,
});

describe("summarizeEquipmentRegistryShadowStatus", () => {
  it("sinaliza ausência total de histórico quando equipment_registry_shadow_runs está vazia", () => {
    const summary = summarizeEquipmentRegistryShadowStatus({ runs: [], liveCounts: {} });
    expect(summary.hasRuns).toBe(false);
    expect(summary.warnings[0]).toMatch(/nunca rodou/);
  });

  it("não gera alerta quando a contagem da última sincronização bate com as tabelas ao vivo", () => {
    const summary = summarizeEquipmentRegistryShadowStatus({
      runs: [run(fullResult())], liveCounts: fullResult(),
    });
    expect(summary.hasRuns).toBe(true);
    expect(summary.warnings).toEqual([]);
  });

  it("alerta quando a contagem registrada diverge das linhas ativas atuais", () => {
    const summary = summarizeEquipmentRegistryShadowStatus({
      runs: [run(fullResult({ equipment: 4 }))],
      liveCounts: fullResult({ equipment: 2 }),
    });
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatch(/equipment.*4.*core_equipment tem 2/);
  });
});

describe("formatEquipmentRegistryShadowStatus", () => {
  it("formata um status limpo, sem alertas, listando as 4 tabelas", () => {
    const summary = summarizeEquipmentRegistryShadowStatus({
      runs: [run(fullResult())], liveCounts: fullResult(),
    });
    const lines = formatEquipmentRegistryShadowStatus(summary);
    Object.values(EQUIPMENT_REGISTRY_TABLES).forEach(table => {
      expect(lines.some(line => line.includes(table))).toBe(true);
    });
    expect(lines.at(-1)).toMatch(/0 divergência/);
  });
});
