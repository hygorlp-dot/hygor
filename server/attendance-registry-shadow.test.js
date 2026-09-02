import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_REGISTRY_SCHEMA_VERSION,
  buildAttendanceRegistrySnapshot,
  compareAttendanceRegistrySnapshot,
  recordId,
} from "./attendance-registry-shadow.js";

const legacy = () => ({
  employees:[
    { id:"e-a", name:"Equipe A" },
    { id:"e-b", name:"Equipe B" },
  ],
  obras:[
    { id:"obra-a", name:"Obra A" },
  ],
  attendance:{
    "e-a":{
      "2026-08-21":{ status:"P", ot:0, note:"", obraId:"obra-a", workedMinutes:480, atrasoMin:0 },
      "2026-08-22":{ status:"F", ot:0, note:"Atestado", obraId:"obra-a" },
      // Tombstone (dia limpo) - nunca vira linha.
      "2026-08-23":null,
    },
    // Funcionário que não existe mais no cadastro - não deve virar linha órfã.
    "e-inexistente":{ "2026-08-21":{ status:"P", obraId:"obra-a" } },
    "e-b":{
      // obraId aponta pra uma obra que não existe - não deve virar linha órfã.
      "2026-08-21":{ status:"P", obraId:"obra-inexistente" },
    },
  },
});

const canonicalFrom = snapshot => ({
  records:snapshot.records.map(row => ({ id:row.id, source_hash:row.sourceHash })),
});

describe("attendance registry shadow", () => {
  it("projeta um registro por (funcionário,data) com status real", () => {
    const snapshot=buildAttendanceRegistrySnapshot(legacy());
    expect(snapshot.schemaVersion).toBe(ATTENDANCE_REGISTRY_SCHEMA_VERSION);
    expect(snapshot.counts).toEqual({ records:2 });
    const byId=Object.fromEntries(snapshot.records.map(row => [row.id, row]));
    expect(byId[recordId("e-a","2026-08-21")]).toMatchObject({
      employeeId:"e-a", date:"2026-08-21", projectId:"obra-a", status:"P", workedMinutes:480,
    });
    expect(byId[recordId("e-a","2026-08-22")]).toMatchObject({ status:"F", note:"Atestado" });
  });

  it("não projeta um dia sem status (tombstone/sem registro)", () => {
    const snapshot=buildAttendanceRegistrySnapshot(legacy());
    expect(snapshot.records.some(row => row.date === "2026-08-23")).toBe(false);
  });

  it("não cria linha órfã para funcionário ou obra que não existem no cadastro", () => {
    const snapshot=buildAttendanceRegistrySnapshot(legacy());
    expect(snapshot.records.some(row => row.employeeId === "e-inexistente")).toBe(false);
    expect(snapshot.records.some(row => row.employeeId === "e-b")).toBe(false);
  });

  it("é determinístico e idempotente para o mesmo legado", () => {
    expect(buildAttendanceRegistrySnapshot(legacy())).toEqual(buildAttendanceRegistrySnapshot(legacy()));
  });

  it("aprova a comparação quando IDs e hashes coincidem", () => {
    const snapshot=buildAttendanceRegistrySnapshot(legacy());
    expect(compareAttendanceRegistrySnapshot(snapshot, canonicalFrom(snapshot))).toEqual([]);
  });

  it("expõe ausência, sobra e alteração sem fallback silencioso", () => {
    const snapshot=buildAttendanceRegistrySnapshot(legacy());
    const canonical=canonicalFrom(snapshot);
    canonical.records.shift();
    canonical.records.push({ id:"inesperado", source_hash:"x" });
    expect(compareAttendanceRegistrySnapshot(snapshot, canonical)).toEqual(expect.arrayContaining([
      { section:"records", key:recordId("e-a","2026-08-21"), reason:"missing" },
      { section:"records", key:"inesperado", reason:"unexpected" },
    ]));
  });
});
