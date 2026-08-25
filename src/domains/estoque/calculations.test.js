import { describe, expect, it } from "vitest";
import { SINAL_MOV, TIPOS_MOV, baixarPorComposicao, calcSaldos, saldoDe } from "./calculations.js";

describe("SINAL_MOV", () => {
  it("deriva o sinal de cada tipo de movimento a partir de TIPOS_MOV", () => {
    expect(SINAL_MOV.entrada).toBe(1);
    expect(SINAL_MOV.consumo).toBe(-1);
    expect(SINAL_MOV.perda).toBe(-1);
    expect(SINAL_MOV.devolucao).toBe(1);
    expect(SINAL_MOV.ajuste).toBe(1);
    expect(Object.keys(SINAL_MOV)).toEqual(TIPOS_MOV.map(t => t.v));
  });
});

describe("calcSaldos / saldoDe", () => {
  it("soma entradas e subtrai consumos por obra+material", () => {
    const saldos = calcSaldos([
      { obraId: "o1", materialId: "m1", tipo: "entrada", qtd: 100 },
      { obraId: "o1", materialId: "m1", tipo: "consumo", qtd: 30 },
      { obraId: "o1", materialId: "m1", tipo: "perda", qtd: 5 },
      { obraId: "o2", materialId: "m1", tipo: "entrada", qtd: 10 },
    ]);
    expect(saldoDe(saldos, "o1", "m1")).toBe(65);
    expect(saldoDe(saldos, "o2", "m1")).toBe(10);
    expect(saldoDe(saldos, "o1", "m2")).toBe(0);
  });

  it("ignora movimentos estornados ou cancelados", () => {
    const saldos = calcSaldos([
      { obraId: "o1", materialId: "m1", tipo: "entrada", qtd: 100 },
      { obraId: "o1", materialId: "m1", tipo: "consumo", qtd: 30, status: "estornado" },
    ]);
    expect(saldoDe(saldos, "o1", "m1")).toBe(100);
  });
});

describe("baixarPorComposicao", () => {
  it("multiplica o coeficiente de cada item pela quantidade executada", () => {
    const comp = { itens: [{ materialId: "cimento", coef: 0.5 }, { materialId: "areia", coef: 1.2 }] };
    expect(baixarPorComposicao(comp, 10)).toEqual([
      { materialId: "cimento", qtd: 5 },
      { materialId: "areia", qtd: 12 },
    ]);
  });

  it("ignora itens sem material ou com coeficiente zero/negativo", () => {
    const comp = { itens: [{ materialId: "", coef: 1 }, { materialId: "x", coef: 0 }, { materialId: "y", coef: -1 }] };
    expect(baixarPorComposicao(comp, 10)).toEqual([]);
  });
});
