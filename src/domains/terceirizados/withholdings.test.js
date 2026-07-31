import { describe, expect, it } from "vitest";
import { calculateWithholdings } from "./withholdings";

describe("calculateWithholdings", () => {
  it("separa ISS e INSS retidos sem reduzir o custo bruto da obra", () => {
    const contractor = {
      retISSQuem: "fonte",
      retISS: 5,
      retINSSQuem: "fonte",
      retINSS: 11,
    };

    expect(calculateWithholdings(10_000, contractor)).toEqual({
      bruto: 10_000,
      issRetido: 500,
      inssRetido: 1_100,
      retido: 1_600,
      liquido: 8_400,
    });
  });

  it("não retém tributo recolhido pelo prestador", () => {
    expect(calculateWithholdings("3500", {
      retISSQuem: "prestador",
      retISS: 5,
      retINSSQuem: "prestador",
      retINSS: 11,
    })).toEqual({
      bruto: 3500,
      issRetido: 0,
      inssRetido: 0,
      retido: 0,
      liquido: 3500,
    });
  });

  it("aceita cadastro incompleto sem alterar o objeto recebido", () => {
    const contractor = { retISSQuem: "fonte" };
    const result = calculateWithholdings(undefined, contractor);

    expect(result).toEqual({
      bruto: 0,
      issRetido: 0,
      inssRetido: 0,
      retido: 0,
      liquido: 0,
    });
    expect(contractor).toEqual({ retISSQuem: "fonte" });
  });
});
