import { describe, expect, it } from "vitest";
import { dataCurtaComAno, faixasMensais } from "./export-timeline.js";

describe("faixasMensais", () => {
  it("divide a janela por mês, com o ano no rótulo, atravessando a virada do ano", () => {
    // 29/09/2026 + 100 dias = até 06/01/2027
    const faixas = faixasMensais("2026-09-29", 100);
    expect(faixas.map(f => f.rotulo)).toEqual(["set/26", "out/26", "nov/26", "dez/26", "jan/27"]);
    expect(faixas[0]).toEqual({ rotulo: "set/26", inicio: 0, dias: 2 });
    expect(faixas[1]).toEqual({ rotulo: "out/26", inicio: 2, dias: 31 });
    expect(faixas.reduce((s, f) => s + f.dias, 0)).toBe(100);
  });

  it("janela vazia ou sem início não gera faixas", () => {
    expect(faixasMensais("", 30)).toEqual([]);
    expect(faixasMensais("2026-09-29", 0)).toEqual([]);
  });
});

describe("dataCurtaComAno", () => {
  it("sempre mostra o ano", () => {
    expect(dataCurtaComAno("2026-10-15")).toBe("15/10/26");
    expect(dataCurtaComAno("2027-07-13")).toBe("13/07/27");
  });
  it("data ausente vira traço, não 'undefined'", () => {
    expect(dataCurtaComAno("")).toBe("-");
    expect(dataCurtaComAno(undefined)).toBe("-");
  });
});
