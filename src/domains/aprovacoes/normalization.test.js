import { describe, expect, it } from "vitest";
import { normalizeApprovalInstances } from "./normalization";

describe("normalização das instâncias de aprovação", () => {
  it("remove registros nulos antes de o menu global consultar status", () => {
    const [instancia] = normalizeApprovalInstances([
      null,
      { id: "apr-1", status: "aprovada", snapshotPolitica: null, resultadosEtapas: [] },
    ]);

    expect(instancia.id).toBe("apr-1");
    expect(normalizeApprovalInstances([null])).toEqual([]);
    expect(() => normalizeApprovalInstances([null]).some(item => item.status === "em_andamento")).not.toThrow();
  });

  it("recompõe resultado nulo alinhado à etapa ativa", () => {
    const [instancia] = normalizeApprovalInstances([{
      id: "apr-2",
      status: "em_andamento",
      ordemAtual: 1,
      snapshotPolitica: {
        id: "pol-1",
        etapas: [
          { id: "eng", ordem: 1, nome: "Engenharia" },
          null,
          { id: "fin", ordem: 2, nome: "Financeiro" },
        ],
      },
      resultadosEtapas: [null, null, { etapaId: "fin", status: "pendente" }],
    }]);

    expect(instancia.snapshotPolitica.etapas.map(etapa => etapa.id)).toEqual(["eng", "fin"]);
    expect(instancia.resultadosEtapas).toEqual([
      expect.objectContaining({ etapaId: "eng", status: "em_andamento", aprovadoresElegiveis: [] }),
      expect.objectContaining({ etapaId: "fin", status: "pendente", aprovadoresElegiveis: [] }),
    ]);
  });

  it("remove aprovadores nulos sem apagar os candidatos válidos", () => {
    const [instancia] = normalizeApprovalInstances([{
      id: "apr-3",
      status: "em_andamento",
      ordemAtual: 1,
      snapshotPolitica: { etapas: [{ id: "e1", ordem: 1 }] },
      resultadosEtapas: [{
        etapaId: "e1",
        status: "em_andamento",
        aprovadoresElegiveis: [null, { id: "u1", nome: "Ana" }],
      }],
    }]);

    expect(instancia.resultadosEtapas[0].aprovadoresElegiveis).toEqual([{ id: "u1", nome: "Ana" }]);
  });
});
