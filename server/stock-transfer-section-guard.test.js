import { describe, expect, it } from "vitest";
import { stockTransferSectionViolation } from "./stock-transfer-section-guard.js";

describe("save-sections não mexe em transferência entre obras (E1.1)", () => {
  const saida = { id: "t1", obraId: "a", obraDestinoId: "b", tipo: "transferencia_saida", qtd: 10, valorUnit: 32.5 };
  const entrada = { id: "e1", obraId: "a", tipo: "entrada", qtd: 20 };

  it("aceita gravar outros movimentos sem tocar na transferência", () => {
    expect(stockTransferSectionViolation([entrada, saida], [entrada, saida, { id: "c1", obraId: "a", tipo: "consumo", qtd: 1 }])).toBe("");
  });

  it("recusa criar chegada, alterar valor, estornar ou apagar uma transferência", () => {
    const chegada = { id: "t1c", obraId: "b", tipo: "transferencia_entrada", transferenciaSaidaId: "t1", qtd: 10, valorUnit: 32.5 };
    expect(stockTransferSectionViolation([saida], [saida, chegada])).toBe("t1c");
    expect(stockTransferSectionViolation([saida], [{ ...saida, valorUnit: 1 }])).toBe("t1");
    expect(stockTransferSectionViolation([saida], [{ ...saida, status: "estornado" }])).toBe("t1");
    expect(stockTransferSectionViolation([saida], [])).toBe("t1");
    expect(stockTransferSectionViolation([saida], [{ ...saida, tipo: "consumo" }])).toBe("t1");
  });
});
