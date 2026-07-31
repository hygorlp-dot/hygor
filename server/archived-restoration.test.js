import { describe, expect, it } from "vitest";
import { restorationRecord, restoreArchivedAttendance } from "./archived-restoration.js";

describe("restauração de quinzena arquivada", () => {
  it("restitui somente os dias que não foram relançados", () => {
    const result = restoreArchivedAttendance({
      attendance: {e1: {"2026-07-07": {status: "F"}}},
      archiveAttendance: {e1: {"2026-07-07": {status: "P"}, "2026-07-08": {status: "P"}}},
      employeesSnapshot:[{id:"e1",dailyRate:125,vtDaily:10,vrDaily:15}],
    });
    expect(result).toMatchObject({devolvidos: 1, mantidos: 1});
    expect(result.attendance.e1["2026-07-07"]).toEqual({status: "F"});
    expect(result.attendance.e1["2026-07-08"]).toEqual({
      status:"P",
      archivedDailyRate:125,
      archivedVtDaily:10,
      archivedVrDaily:15,
      archivedWorkdayHours:8,
      archivedWorkStart:"07:00",
      archivedOvertimeAdditionalPercent:50,
    });
  });

  it("registra a restauração sem alterar a fotografia arquivada", () => {
    const archive = {meta: {quinzenaId: "2026-07-Q1", archivedAt: "2026-07-20T10:00:00.000Z"}};
    const record = restorationRecord({archive, quinzenaId: "2026-07-Q1", actor: {id: "u1", nome: "Ana"}, at: "2026-07-21T10:00:00.000Z"});
    expect(record).toEqual(expect.objectContaining({archiveKey: "2026-07-Q1", restoredBy: {id: "u1", nome: "Ana"}}));
    expect(archive).toEqual({meta: {quinzenaId: "2026-07-Q1", archivedAt: "2026-07-20T10:00:00.000Z"}});
  });
});
