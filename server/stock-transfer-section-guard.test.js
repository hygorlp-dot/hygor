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

describe("save-sections não mexe em ajuste de inventário (E1.2)", () => {
  it("recusa criar ou apagar ajuste gerado por contagem, aceita ajuste avulso", () => {
    const ajusteInventario = { id: "i1-cim", obraId: "a", tipo: "ajuste_saida", qtd: 4, inventarioId: "i1" };
    const sobra = { id: "i1-aco", obraId: "a", tipo: "ajuste", qtd: 2, inventarioId: "i1" };
    expect(stockTransferSectionViolation([], [ajusteInventario])).toBe("i1-cim");
    expect(stockTransferSectionViolation([sobra], [])).toBe("i1-aco");
    expect(stockTransferSectionViolation([], [{ id: "av", obraId: "a", tipo: "ajuste", qtd: 1 }])).toBe("");
  });
});
