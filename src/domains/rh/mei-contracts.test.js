import { describe, it, expect } from "vitest";
import { validCnpj, createMeiContract, meiCostCenter } from "./mei-contracts.js";
const base = { providerName: "Prestador MEI", cnpj: "11.222.333/0001-81", service: "Manutenção", scope: "administrativo", obraId: "", frequency: "mensal", fixedAmount: 2500, startDate: "2026-10-28" };
describe("contratos MEI (sem vínculo com folha CLT)", () => {
  it("valida dígitos verificadores do CNPJ", () => {
    expect(validCnpj("11.222.333/0001-81")).toBe(true);
    expect(validCnpj("11.222.333/0001-82")).toBe(false);
  });
  it("mantém administrativo sem obra e valor fixo", () => {
    const result = createMeiContract(base);
    expect(result.ok).toBe(true);
    expect(result.contract.fixedAmount).toBe(2500);
    expect(meiCostCenter(result.contract)).toEqual({ type: "administrativo", obraId: null });
  });
  it("exige obra existente para terceirizado", () => {
    expect(createMeiContract({ ...base, scope: "terceirizado" }).ok).toBe(false);
    const result = createMeiContract({ ...base, scope: "terceirizado", obraId: "o1" }, [{id:"o1"}]);
    expect(result.ok).toBe(true);
    expect(meiCostCenter(result.contract)).toEqual({ type: "obra", obraId: "o1" });
  });
});
