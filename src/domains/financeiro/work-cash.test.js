import { describe, expect, it } from "vitest";
import { calculateWorkCash } from "./work-cash.js";

describe("motor do caixa de obra", () => {
  it("ordena movimentos, calcula saldo acumulado e isola a obra", () => {
    const result = calculateWorkCash({
      caixaObra:[
        { id:"d1", obraId:"o1", tipo:"despesa", valor:30, data:"2026-07-03" },
        { id:"a1", obraId:"o1", tipo:"aporte", valor:100, data:"2026-07-01" },
        { id:"x1", obraId:"o2", tipo:"aporte", valor:999, data:"2026-07-01" },
      ],
    }, "o1");

    expect(result).toMatchObject({
      saldo:70,
      totalAportes:100,
      totalDespesas:30,
    });
    expect(result.movimentos.map(item => [item.id, item.saldoAcumulado])).toEqual([
      ["d1", 70],
      ["a1", 100],
    ]);
  });
});
