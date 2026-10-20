import { describe, expect, it } from "vitest";
import { dreSourceRevision } from "./dre-projection.js";

// A DRE materializada só é reaproveitada enquanto esta revisão não muda.
// Antes ela era só o updated_at da linha core: uma correção de ponto (linha
// por obra) ou de feriado cadastrado (linha config) não invalidava a DRE.
describe("revisão da DRE materializada", () => {
  const base = {
    updatedAt: "2026-10-20T14:28:25Z",
    rowVersions: { core: "2026-10-20T14:28:25Z", config: "2026-09-04T18:00:46Z" },
    rowVersionsPontoObra: { "8ln6rr8k": "2026-10-20T14:28:51Z", rx7uzocuy5dj: "2026-10-20T14:28:51Z" },
  };

  it("muda quando muda o ponto de qualquer obra, mesmo com a linha core igual", () => {
    const depois = { ...base, rowVersionsPontoObra: { ...base.rowVersionsPontoObra, "8ln6rr8k": "2026-10-20T15:10:00Z" } };
    expect(dreSourceRevision(depois)).not.toBe(dreSourceRevision(base));
  });

  it("muda quando muda a config (feriados cadastrados) ou surge a linha de uma obra nova", () => {
    expect(dreSourceRevision({ ...base, rowVersions: { ...base.rowVersions, config: "2026-10-20T16:00:00Z" } })).not.toBe(dreSourceRevision(base));
    expect(dreSourceRevision({ ...base, rowVersionsPontoObra: { ...base.rowVersionsPontoObra, xlddwbjqdj6p: "2026-10-20T13:34:54Z" } })).not.toBe(dreSourceRevision(base));
  });

  it("é estável: mesma informação em outra ordem dá a mesma revisão", () => {
    const invertido = {
      updatedAt: base.updatedAt,
      rowVersions: { config: base.rowVersions.config, core: base.rowVersions.core },
      rowVersionsPontoObra: { rx7uzocuy5dj: base.rowVersionsPontoObra.rx7uzocuy5dj, "8ln6rr8k": base.rowVersionsPontoObra["8ln6rr8k"] },
    };
    expect(dreSourceRevision(invertido)).toBe(dreSourceRevision(base));
  });
});
