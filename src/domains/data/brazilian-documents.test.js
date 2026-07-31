import { describe, expect, it } from "vitest";
import {
  digitsOnly,
  formatBrazilianDocument,
  formatCEP,
  validateBrazilianDocument,
  validateCNPJ,
  validateCPF,
} from "./brazilian-documents";

describe("documentos brasileiros", () => {
  it("valida CPF e rejeita dígitos repetidos ou verificadores incorretos", () => {
    expect(validateCPF("529.982.247-25")).toBe(true);
    expect(validateCPF("529.982.247-24")).toBe(false);
    expect(validateCPF("111.111.111-11")).toBe(false);
  });

  it("valida CNPJ e rejeita dígitos repetidos ou verificadores incorretos", () => {
    expect(validateCNPJ("04.252.011/0001-10")).toBe(true);
    expect(validateCNPJ("04.252.011/0001-11")).toBe(false);
    expect(validateCNPJ("00.000.000/0000-00")).toBe(false);
  });

  it("seleciona a validação pelo tipo de pessoa", () => {
    expect(validateBrazilianDocument("52998224725", "PF")).toBe(true);
    expect(validateBrazilianDocument("04252011000110", "PJ")).toBe(true);
  });

  it("normaliza e formata documentos e CEP sem exceder o limite", () => {
    expect(digitsOnly("CPF 529.982.247-25")).toBe("52998224725");
    expect(formatBrazilianDocument("5299822472599", "PF")).toBe("529.982.247-25");
    expect(formatBrazilianDocument("0425201100011099", "PJ")).toBe("04.252.011/0001-10");
    expect(formatCEP("5003017099")).toBe("50030-170");
  });
});
