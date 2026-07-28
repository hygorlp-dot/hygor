import { describe, expect, it } from "vitest";
import { saldoPagamentoNota, statusPagamentoNota, totalPagoNota } from "./payables.js";

describe("posição de pagamento de notas fiscais", () => {
  it("calcula pagamento parcial e saldo sem arredondamento de estado", () => {
    const nota = {
      valorLiquido:1000,
      pagamentos:[{ valor:250 }, { valor:"150.00" }],
    };
    expect(totalPagoNota(nota)).toBe(400);
    expect(saldoPagamentoNota(nota)).toBe(600);
    expect(statusPagamentoNota(nota)).toBe("parcial");
  });

  it("fecha com tolerância de um centavo e preserva cancelamento", () => {
    expect(statusPagamentoNota({
      valorBruto:100,
      pagamentos:[{ valor:99.995 }],
    })).toBe("paga");
    expect(statusPagamentoNota({
      status:"cancelada",
      valorBruto:100,
      pagamentos:[{ valor:100 }],
    })).toBe("cancelada");
  });

  it("distingue nota autorizada de documento ainda em conferência", () => {
    expect(statusPagamentoNota({ status:"aprovada", valorBruto:100 })).toBe("autorizada");
    expect(statusPagamentoNota({ status:"rascunho", valorBruto:100 })).toBe("conferencia");
  });
});
