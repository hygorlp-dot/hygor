import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_REGISTRY_TABLES, formatAttendanceRegistryShadowStatus, summarizeAttendanceRegistryShadowStatus,
} from "./attendance-registry-shadow-status.js";

const run = (result, createdAt = "2026-09-02T10:00:00.000Z", actorId = "system:production-deploy") => ({
  result, created_at: createdAt, actor_id: actorId,
});

const fullResult = (overrides = {}) => ({
  records: 120,
  ...overrides,
});

describe("summarizeAttendanceRegistryShadowStatus", () => {
  it("sinaliza ausência total de histórico quando attendance_registry_shadow_runs está vazia", () => {
    const summary = summarizeAttendanceRegistryShadowStatus({ runs: [], liveCounts: {} });
    expect(summary.hasRuns).toBe(false);
    expect(summary.warnings[0]).toMatch(/nunca rodou/);
  });

  it("não gera alerta quando a contagem da última sincronização bate com a tabela ao vivo", () => {
    const summary = summarizeAttendanceRegistryShadowStatus({
      runs: [run(fullResult())], liveCounts: fullResult(),
    });
    expect(summary.hasRuns).toBe(true);
    expect(summary.warnings).toEqual([]);
  });

  it("alerta quando a contagem registrada diverge das linhas ativas atuais", () => {
    const summary = summarizeAttendanceRegistryShadowStatus({
      runs: [run(fullResult({ records: 120 }))],
      liveCounts: fullResult({ records: 90 }),
    });
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatch(/records.*120.*core_attendance_records tem 90/);
  });

  it("alerta quando a contagem cai a zero em relação à sincronização anterior", () => {
    const summary = summarizeAttendanceRegistryShadowStatus({
      runs: [run(fullResult({ records: 0 })), run(fullResult({ records: 120 }), "2026-09-01T10:00:00.000Z")],
      liveCounts: fullResult({ records: 0 }),
    });
    expect(summary.warnings.some(warning => warning.includes("caiu de 120 para 0"))).toBe(true);
  });
});

describe("formatAttendanceRegistryShadowStatus", () => {
  it("formata um status limpo, sem alertas, listando a tabela", () => {
    const summary = summarizeAttendanceRegistryShadowStatus({
      runs: [run(fullResult())], liveCounts: fullResult(),
    });
    const lines = formatAttendanceRegistryShadowStatus(summary);
    Object.values(ATTENDANCE_REGISTRY_TABLES).forEach(table => {
      expect(lines.some(line => line.includes(table))).toBe(true);
    });
    expect(lines.at(-1)).toMatch(/0 divergência/);
  });
});
