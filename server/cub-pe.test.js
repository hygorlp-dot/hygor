import { describe, expect, it } from "vitest";
import { parseCubPeComposition } from "./cub-pe.js";

describe("CUB-PE", () => {
  it("associa os totais oficiais a cada projeto, mesmo sem separação entre colunas", () => {
    const text = `
Projetos-Padrão Residenciais - Baixo
ItemR1-BPP-4-BR8-BPIS
Total2.219,961.974,301.853,511.493,56
Projetos-Padrão Residenciais - Normal
ItemR1-NPP-4-NR8-NR16-N
Total2.639,912.522,232.116,152.057,96
Projetos-Padrão Residenciais - Alto
ItemR1-AR8-AR16-A
Total3.210,042.583,052.656,88
Projetos-Padrão Comerciais - Normal
ItemCAL-8-NCSL-8-NCSL-16-N
Total2.400,002.100,002.800,00
Projetos-Padrão Comerciais - Alto
ItemCAL-8-ACSL-8-ACSL-16-A
Total2.600,002.300,003.000,00
Projeto-Padrão Residência Popular
ItemRP1Q
Total2.000,00
Projeto-Padrão Galpão Industrial
ItemGI
Total1.100,00`;

    expect(parseCubPeComposition(text)).toMatchObject({
      "R1-B": 2219.96,
      "PP-4-N": 2522.23,
      "R8-N": 2116.15,
      "R1-A": 3210.04,
      "R16-A": 2656.88,
      RP1Q: 2000,
      GI: 1100,
    });
  });
});
