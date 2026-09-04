import { describe, it, expect } from "vitest";
import { findAttendanceSyncedAtGaps, formatAttendanceSyncedAtGapsReport } from "./attendance-synced-at-audit.js";

describe("findAttendanceSyncedAtGaps", () => {
  it("não acusa nada quando só uma linha contribui para a célula", () => {
    const sources = [
      { label: "OBRA:a", attendance: { e1: { "2026-08-21": { status: "P" } } }, syncedAt: {} },
    ];
    const summary = findAttendanceSyncedAtGaps(sources);
    expect(summary.totalGapCells).toBe(0);
    expect(summary.conflictingCells).toBe(0);
  });

  it("não acusa nada quando a célula já tem carimbo em pelo menos uma das linhas", () => {
    const sources = [
      { label: "OBRA:a", attendance: { e1: { "2026-08-21": { status: "P" } } }, syncedAt: { e1: { "2026-08-21": "2026-09-04T10:00:00.000Z" } } },
      { label: "OBRA:b", attendance: { e1: { "2026-08-21": null } }, syncedAt: {} },
    ];
    // só uma das duas linhas está sem carimbo - não é o cenário de risco
    // (o cálculo de gap exige >1 linha SEM carimbo contribuindo)
    const summary = findAttendanceSyncedAtGaps(sources);
    expect(summary.totalGapCells).toBe(0);
  });

  it("acusa gap trivial (só uma das linhas sem carimbo tem valor real) mas NÃO como conflitante", () => {
    const sources = [
      { label: "OBRA:a", attendance: { e1: { "2026-08-21": { status: "P" } } }, syncedAt: {} },
      { label: "OBRA:b", attendance: { e1: { "2026-08-21": null } }, syncedAt: {} },
    ];
    const summary = findAttendanceSyncedAtGaps(sources);
    expect(summary.totalGapCells).toBe(1);
    expect(summary.conflictingCells).toBe(0);
  });

  it("acusa como CONFLITANTE quando duas linhas sem carimbo têm valores reais diferentes para a mesma célula", () => {
    const sources = [
      { label: "OBRA:k1-04", attendance: { e1: { "2026-08-21": { status: "P", obraId: "k1-04" } } }, syncedAt: {} },
      { label: "OBRA:r1-16", attendance: { e1: { "2026-08-21": { status: "P", obraId: "r1-16" } } }, syncedAt: {} },
    ];
    const summary = findAttendanceSyncedAtGaps(sources);
    expect(summary.totalGapCells).toBe(1);
    expect(summary.conflictingCells).toBe(1);
    expect(summary.gaps[0]).toMatchObject({ employeeId: "e1", date: "2026-08-21", conflicting: true });
  });

  it("ordena conflitantes primeiro no relatório", () => {
    const sources = [
      { label: "OBRA:a", attendance: {
        e1: { "2026-08-21": { status: "P" } },
        e2: { "2026-08-22": { status: "P" } },
      }, syncedAt: {} },
      { label: "OBRA:b", attendance: {
        e1: { "2026-08-21": null },
        e2: { "2026-08-22": { status: "F" } },
      }, syncedAt: {} },
    ];
    const summary = findAttendanceSyncedAtGaps(sources);
    expect(summary.totalGapCells).toBe(2);
    expect(summary.conflictingCells).toBe(1);
    expect(summary.gaps[0].conflicting).toBe(true);
  });
});

describe("formatAttendanceSyncedAtGapsReport", () => {
  it("relata 'nenhuma lacuna' quando o resumo está limpo", () => {
    const lines = formatAttendanceSyncedAtGapsReport({ totalGapCells: 0, conflictingCells: 0, gaps: [] });
    expect(lines.join("\n")).toMatch(/Nenhuma lacuna encontrada/);
  });

  it("relata 'sem risco real' quando há gaps mas nenhum conflitante", () => {
    const lines = formatAttendanceSyncedAtGapsReport({ totalGapCells: 3, conflictingCells: 0, gaps: [] });
    expect(lines.join("\n")).toMatch(/Sem risco real/);
  });

  it("lista as células conflitantes quando existem", () => {
    const gaps = [{ employeeId: "e1", date: "2026-08-21", sources: ["OBRA:a", "OBRA:b"], conflicting: true }];
    const lines = formatAttendanceSyncedAtGapsReport({ totalGapCells: 1, conflictingCells: 1, gaps });
    expect(lines.join("\n")).toMatch(/ATENÇÃO/);
    expect(lines.join("\n")).toMatch(/e1 em 2026-08-21/);
  });
});
