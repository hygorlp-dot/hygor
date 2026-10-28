import { describe, expect, it } from "vitest";
import { aplicarCustoApropriado, custoApropriadoPorTarefa, totalMaterialAplicado } from "./cost-allocation.js";
import { fisicoFinanceiro } from "./legacy-engine.js";

const mov = [
  { id:"m1", obraId:"o1", tipo:"consumo", tarefaId:"t1", qtd:10, valorUnit:30 },
  { id:"m2", obraId:"o1", tipo:"consumo", tarefaId:"t1", qtd:2, valorUnit:30, status:"estornado" },
  { id:"m3", obraId:"o1", tipo:"perda", tarefaId:"t1", qtd:5, valorUnit:30 },
  { id:"m4", obraId:"o1", tipo:"consumo", qtd:5, valorUnit:30 },
  { id:"m5", obraId:"o2", tipo:"consumo", tarefaId:"t1", qtd:5, valorUnit:30 },
  { id:"m6", obraId:"o1", tipo:"consumo", tarefaId:"t2", qtd:1, valorUnit:50 },
];

describe("material aplicado por tarefa", () => {
  it("soma só consumo ativo, da obra, carimbado com a tarefa", () => {
    const porTarefa = custoApropriadoPorTarefa(mov, "o1");
    expect(porTarefa.get("t1")).toEqual({ material:300, movimentos:1 });
    expect(porTarefa.get("t2")).toEqual({ material:50, movimentos:1 });
  });

  it("aparece na tarefa sem mexer no custo real nem no CPI", () => {
    const tarefas = [
      { id:"t0", titulo:true },
      { id:"t1", custo:1000, progresso:50, custoReal:0 },
      { id:"t2", custo:500, progresso:100, custoReal:450 },
    ];
    const comMaterial = aplicarCustoApropriado(tarefas, custoApropriadoPorTarefa(mov, "o1"));
    expect(comMaterial[1]).toMatchObject({ materialAplicado:300, custoReal:0 });
    expect(totalMaterialAplicado(comMaterial)).toBe(350);
    expect(fisicoFinanceiro(comMaterial).total.cpi).toBeCloseTo(500 / 450, 6);
  });
});
