import { describe, expect, it } from "vitest";
import { exigeTarefaNoConsumo, resolverTarefaDoConsumo, tarefasParaConsumo } from "./task-allocation.js";
import { applyStockCommand, STOCK_COMMAND } from "./commands.js";

const data = {
  obras:[{ id:"o1" }, { id:"o2" }],
  planos:[{ obraId:"o1", tarefas:[
    { id:"t0", titulo:true, nome:"Estrutura" },
    { id:"t1", nome:"Reboco", etapaId:"e3", inicio:"2026-10-20", fim:"2026-11-05", progresso:20 },
    { id:"t2", nome:"Pintura", etapaId:"e4", inicio:"2026-12-01", fim:"2026-12-20", progresso:0 },
    { id:"t3", nome:"Fundação", etapaId:"e1", inicio:"2026-08-01", fim:"2026-08-20", progresso:100 },
  ] }],
  movEstoque:[{ id:"in1", obraId:"o1", materialId:"cim", tipo:"entrada", qtd:100 }, { id:"in2", obraId:"o2", materialId:"cim", tipo:"entrada", qtd:10 }],
};

const consumo = (extra = {}) => applyStockCommand(data, {
  type:STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED,
  payload:{ movement:{ id:"c1", obraId:"o1", materialId:"cim", tipo:"consumo", qtd:5, ...extra } },
}, "2026-10-28T12:00:00.000Z");

describe("consumo de estoque por tarefa do cronograma", () => {
  it("oferece primeiro as tarefas em andamento na semana e esconde as concluídas", () => {
    const lista = tarefasParaConsumo(data, "o1", "2026-10-28");
    expect(lista.map(t => [t.id, t.emAndamento])).toEqual([["t1", true], ["t2", false]]);
  });

  it("exige a tarefa no consumo de obra com cronograma e carimba tarefa e etapa", () => {
    expect(consumo().reason).toMatch(/tarefa do cronograma/);
    expect(consumo({ tarefaId:"t0" }).ok).toBe(false);
    const ok = consumo({ tarefaId:"t1" });
    expect(ok.ok).toBe(true);
    expect(ok.data.movEstoque.at(-1)).toMatchObject({ tarefaId:"t1", tarefaNome:"Reboco", etapaId:"e3" });
  });

  it("obra sem cronograma, entrada e perda não exigem tarefa", () => {
    expect(exigeTarefaNoConsumo(data, "o2")).toBe(false);
    expect(resolverTarefaDoConsumo(data, { obraId:"o2", tipo:"consumo" }).ok).toBe(true);
    expect(consumo({ tipo:"perda" }).ok).toBe(true);
    expect(consumo({ tipo:"entrada" }).ok).toBe(true);
  });

  it("execução de serviço também exige a tarefa", () => {
    const comp = { id:"alv", nome:"Alvenaria", unidade:"m2", itens:[{ materialId:"cim", coef:1 }] };
    const base = { ...data, composicoes:[comp] };
    const run = tarefaId => applyStockCommand(base, {
      type:STOCK_COMMAND.SERVICE_EXECUTION_RECORDED,
      payload:{ compositionId:"alv", obraId:"o1", qtdExecutada:2, tarefaId, entries:[{ id:"x1", materialId:"cim", qtd:2 }] },
    }, "2026-10-28T12:00:00.000Z");
    expect(run("").ok).toBe(false);
    expect(run("t1").data.movEstoque.at(-1)).toMatchObject({ tarefaId:"t1", etapaId:"e3", servicoId:"alv" });
  });
});
