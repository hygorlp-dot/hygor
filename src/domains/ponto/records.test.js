import { describe, expect, it } from "vitest";
import { normalizeAttendanceRecord } from "./records";

describe("normalização preservadora do registro de ponto", () => {
  it("mantém jornada, atraso e valores congelados", () => {
    const input={
      status:"P",
      ot:"2",
      obraId:"o1",
      entrada:"07:15",
      intervaloSaida:"12:00",
      intervaloRetorno:"13:00",
      saida:"17:00",
      workedMinutes:525,
      atrasoMin:15,
      archivedDailyRate:125,
      archivedWorkStart:"07:00",
    };
    expect(normalizeAttendanceRecord(input)).toEqual({
      ...input,
      ot:2,
      note:"",
    });
  });

  it("converte o formato legado em objeto sem inventar campos", () => {
    expect(normalizeAttendanceRecord("M")).toEqual({
      status:"M",
      ot:0,
      note:"",
      obraId:"",
    });
  });
});
