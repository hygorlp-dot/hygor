import { describe, expect, it } from "vitest";
import { calculateBdi, classifyBdi, formatBdiPercent } from "./bdi";

describe("motor BDI", () => {
  it("aplica a fórmula multiplicativa do TCU", () => {
    const result = calculateBdi({ ac:4, seguro:.8, risco:1.27, garantia:0, df:1.23, lucro:7.4, pis:.65, cofins:3, iss:2, cprb:0 });
    expect(result.erro).toBeNull();
    expect(result.bdi).toBeCloseTo(22.2262, 3);
    expect(result.tributos).toBeCloseTo(5.65, 8);
  });

  it("bloqueia tributos iguais ou superiores a 100%", () => {
    expect(calculateBdi({ iss:100 })).toEqual({ bdi:0, tributos:100, erro:"Tributos somam 100% ou mais." });
  });

  it("classifica a faixa e mantém a formatação brasileira", () => {
    expect(classifyBdi(22.12, "edificios").st).toBe("dentro");
    expect(classifyBdi(30, "edificios").st).toBe("acima");
    expect(formatBdiPercent(3)).toBe("3,00%");
  });
});
