import { describe, expect, it } from "vitest";
import { compareCpmResults } from "./legacy-canonical-diff.js";

describe("compareCpmResults", () => {
  it("não acusa divergência quando os dois motores concordam", () => {
    const legacy = { fimProjeto: 6, criticas: ["a", "b", "c"], folgas: { a: 0, b: 0, c: 0, d: 3 } };
    const canonical = {
      projectDuration: 6,
      criticalPath: ["a", "b", "c"],
      activities: [
        { id: "a", totalFloat: 0 }, { id: "b", totalFloat: 0 },
        { id: "c", totalFloat: 0 }, { id: "d", totalFloat: 3 },
      ],
    };
    expect(compareCpmResults(legacy, canonical)).toEqual({ divergente: false, divergencias: [] });
  });

  it("acusa divergência de duração total do projeto", () => {
    const result = compareCpmResults({ fimProjeto: 6, criticas: [], folgas: {} }, { projectDuration: 8, criticalPath: [], activities: [] });
    expect(result.divergente).toBe(true);
    expect(result.divergencias).toEqual([{ campo: "duracaoProjeto", legado: 6, canonico: 8 }]);
  });

  it("acusa divergência no conjunto de atividades críticas, nos dois sentidos", () => {
    const legacy = { fimProjeto: 6, criticas: ["a", "b"], folgas: {} };
    const canonical = { projectDuration: 6, criticalPath: ["a", "c"], activities: [] };
    const result = compareCpmResults(legacy, canonical);
    expect(result.divergente).toBe(true);
    expect(result.divergencias).toContainEqual({ campo: "caminhoCritico", somenteNoLegado: ["b"], somenteNoCanonico: ["c"] });
  });

  it("acusa divergência de folga por atividade, tolerando diferença de arredondamento até 0,01", () => {
    const legacy = { fimProjeto: 6, criticas: [], folgas: { d: 3, e: 1.001 } };
    const canonical = { projectDuration: 6, criticalPath: [], activities: [{ id: "d", totalFloat: 5 }, { id: "e", totalFloat: 1.005 }] };
    const result = compareCpmResults(legacy, canonical);
    expect(result.divergente).toBe(true);
    expect(result.divergencias).toContainEqual({ campo: "folgas", itens: [{ id: "d", legado: 3, canonico: 5 }] });
  });

  it("ignora atividades que só existem em um dos dois motores (ex.: migração parcial em andamento)", () => {
    const legacy = { fimProjeto: 6, criticas: ["a"], folgas: { a: 0, "somente-legado": 4 } };
    const canonical = { projectDuration: 6, criticalPath: ["a"], activities: [{ id: "a", totalFloat: 0 }] };
    expect(compareCpmResults(legacy, canonical)).toEqual({ divergente: false, divergencias: [] });
  });
});
