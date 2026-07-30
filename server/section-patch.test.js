import { describe, expect, it } from "vitest";
import {
  changedTopLevelSections,
  projectChangedSectionsPatch,
} from "./section-patch.js";

describe("patch enxuto de mutações", () => {
  it("retorna apenas as seções cujas referências mudaram", () => {
    const sharedProjects = [{ id:"obra-1" }];
    const before = {
      obras:sharedProjects,
      despesasEmpresa:[{ id:"d-1", valor:100 }],
      operationalCommandReceipts:[],
    };
    const after = {
      ...before,
      despesasEmpresa:[{ id:"d-1", valor:100, status:"cancelada" }],
      operationalCommandReceipts:[{ idempotencyKey:"expense-cancel-1" }],
    };

    expect(changedTopLevelSections(before, after)).toEqual([
      "despesasEmpresa",
      "operationalCommandReceipts",
    ]);
    expect(projectChangedSectionsPatch(
      before,
      after,
      { id:"admin", role:"admin" },
      { exclude:["operationalCommandReceipts"] },
    )).toEqual({
      despesasEmpresa:after.despesasEmpresa,
    });
  });

  it("não inclui no patch seções fora da projeção do perfil", () => {
    const before = { obras:[], despesasEmpresa:[] };
    const after = {
      ...before,
      despesasEmpresa:[{ id:"d-1", valor:100 }],
    };

    expect(projectChangedSectionsPatch(
      before,
      after,
      { id:"comercial", role:"comercial" },
    )).toEqual({});
  });

  it("reduz materialmente a resposta de um comando pequeno", () => {
    const largeUnchangedSection = Array.from({ length:2_000 }, (_, index) => ({
      id:`registro-${index}`,
      descricao:"x".repeat(180),
    }));
    const before = {
      obras:largeUnchangedSection,
      despesasEmpresa:[{ id:"d-1", valor:100 }],
    };
    const after = {
      ...before,
      despesasEmpresa:[{ id:"d-1", valor:100, status:"cancelada" }],
    };
    const patch = projectChangedSectionsPatch(
      before,
      after,
      { id:"admin", role:"admin" },
    );

    expect(JSON.stringify(patch).length)
      .toBeLessThan(JSON.stringify(after).length * 0.01);
  });
});
