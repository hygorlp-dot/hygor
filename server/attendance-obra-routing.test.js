import { describe, expect, it } from "vitest";
import {
  applyEntriesToAttendance, attendanceObraBucket, attendanceObraKey,
  attendanceObraKeyPrefix, groupAttendanceEntriesByObra, mergeAttendanceObjects,
  NO_OBRA_BUCKET, obraBucketFromKey,
} from "./attendance-obra-routing.js";

describe("attendanceObraBucket", () => {
  it("usa o obraId como balde quando presente", () => {
    expect(attendanceObraBucket("obra-1")).toBe("obra-1");
  });
  it("cai no balde sem_obra para vazio/nulo/undefined", () => {
    expect(attendanceObraBucket("")).toBe(NO_OBRA_BUCKET);
    expect(attendanceObraBucket(null)).toBe(NO_OBRA_BUCKET);
    expect(attendanceObraBucket(undefined)).toBe(NO_OBRA_BUCKET);
  });
});

describe("attendanceObraKey / obraBucketFromKey", () => {
  it("é reversível - obraBucketFromKey desfaz attendanceObraKey", () => {
    const key = attendanceObraKey("arced_ponto_v1__ponto", "obra-42");
    expect(key).toBe("arced_ponto_v1__ponto__obra__obra-42");
    expect(obraBucketFromKey("arced_ponto_v1__ponto", key)).toBe("obra-42");
  });
  it("o prefixo bate com o usado para o filtro LIKE do banco", () => {
    expect(attendanceObraKeyPrefix("BASE")).toBe("BASE__obra__");
    expect(attendanceObraKey("BASE", "x")).toBe("BASE__obra__x");
  });
});

describe("mergeAttendanceObjects", () => {
  it("mescla funcionários distintos de fontes diferentes", () => {
    const merged = mergeAttendanceObjects(
      { e1: { "2026-08-01": { status: "P" } } },
      { e2: { "2026-08-01": { status: "F" } } },
    );
    expect(merged).toEqual({
      e1: { "2026-08-01": { status: "P" } },
      e2: { "2026-08-01": { status: "F" } },
    });
  });

  it("fontes posteriores vencem no mesmo (employeeId,date) - linha por obra prioriza sobre a legada", () => {
    const legado = { e1: { "2026-08-01": { status: "P", note: "antigo" } } };
    const daObra = { e1: { "2026-08-01": { status: "F", note: "novo" } } };
    expect(mergeAttendanceObjects(legado, daObra).e1["2026-08-01"]).toEqual({ status: "F", note: "novo" });
  });

  it("preserva dias de um mesmo funcionário vindos de fontes diferentes", () => {
    const merged = mergeAttendanceObjects(
      { e1: { "2026-08-01": { status: "P" } } },
      { e1: { "2026-08-02": { status: "F" } } },
    );
    expect(merged.e1).toEqual({ "2026-08-01": { status: "P" }, "2026-08-02": { status: "F" } });
  });

  it("devolve objeto vazio sem argumentos", () => {
    expect(mergeAttendanceObjects()).toEqual({});
  });
});

describe("groupAttendanceEntriesByObra", () => {
  it("agrupa entradas por obra, mantendo a ordem de chegada", () => {
    const entries = [
      { employeeId: "e1", date: "2026-08-01", obraId: "obra-a" },
      { employeeId: "e2", date: "2026-08-01", obraId: "obra-b" },
      { employeeId: "e3", date: "2026-08-01", obraId: "obra-a" },
    ];
    const grouped = groupAttendanceEntriesByObra(entries);
    expect([...grouped.keys()]).toEqual(["obra-a", "obra-b"]);
    expect(grouped.get("obra-a")).toHaveLength(2);
    expect(grouped.get("obra-b")).toHaveLength(1);
  });

  it("agrupa entradas sem obra no balde sem_obra", () => {
    const grouped = groupAttendanceEntriesByObra([{ employeeId: "e1", date: "2026-08-01", obraId: "" }]);
    expect([...grouped.keys()]).toEqual([NO_OBRA_BUCKET]);
  });

  it("devolve mapa vazio para lista vazia/ausente", () => {
    expect(groupAttendanceEntriesByObra([]).size).toBe(0);
    expect(groupAttendanceEntriesByObra(undefined).size).toBe(0);
  });
});

describe("applyEntriesToAttendance", () => {
  it("adiciona/atualiza um registro usando o valor final de fullAttendanceAfter", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } } };
    const after = { e1: { "2026-08-01": { status: "P" }, "2026-08-02": { status: "M" } } };
    const entries = [{ employeeId: "e1", date: "2026-08-02" }];
    expect(applyEntriesToAttendance(existing, entries, after)).toEqual({
      e1: { "2026-08-01": { status: "P" }, "2026-08-02": { status: "M" } },
    });
  });

  it("remove o registro quando fullAttendanceAfter não tem mais essa data (exclusão)", () => {
    const existing = { e1: { "2026-08-01": { status: "P" }, "2026-08-02": { status: "M" } } };
    const after = { e1: { "2026-08-01": { status: "P" } } };
    const entries = [{ employeeId: "e1", date: "2026-08-02" }];
    expect(applyEntriesToAttendance(existing, entries, after)).toEqual({
      e1: { "2026-08-01": { status: "P" } },
    });
  });

  it("remove o funcionário inteiro quando o último dia dele é excluído", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } } };
    const after = {};
    const entries = [{ employeeId: "e1", date: "2026-08-01" }];
    expect(applyEntriesToAttendance(existing, entries, after)).toEqual({});
  });

  it("não toca em funcionários/dias fora da lista de entradas", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } }, e2: { "2026-08-01": { status: "F" } } };
    const after = { e1: { "2026-08-01": { status: "M" } }, e2: { "2026-08-01": { status: "F" } } };
    const entries = [{ employeeId: "e1", date: "2026-08-01" }];
    expect(applyEntriesToAttendance(existing, entries, after).e2).toEqual({ "2026-08-01": { status: "F" } });
  });

  it("devolve cópia do existente quando não há entradas", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } } };
    expect(applyEntriesToAttendance(existing, [], existing)).toEqual(existing);
  });
});
