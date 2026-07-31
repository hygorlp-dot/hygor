import { describe, expect, it } from "vitest";
import {
  isActiveThirdPartyContract,
  isThirdPartyRecordActive,
  THIRD_PARTY_INACTIVE_STATUSES,
} from "./lifecycle";

describe("ciclo de vida de terceirizados", () => {
  it("remove efeitos de cancelamentos, estornos e contratos arquivados", () => {
    for (const status of THIRD_PARTY_INACTIVE_STATUSES) {
      expect(isThirdPartyRecordActive({ status })).toBe(false);
    }
    expect(isThirdPartyRecordActive({ status: " CANCELADO " })).toBe(false);
  });

  it("mantém registros legados sem status e registros operacionais", () => {
    expect(isThirdPartyRecordActive({})).toBe(true);
    expect(isThirdPartyRecordActive(null)).toBe(true);
    expect(isThirdPartyRecordActive({ status: "aprovada" })).toBe(true);
    expect(isThirdPartyRecordActive({ status: "pago" })).toBe(true);
  });

  it("preserva medição arquivada como fato histórico e econômico", () => {
    expect(isThirdPartyRecordActive({ status: "arquivada", total: 3500 })).toBe(true);
  });

  it("considera a desativação explícita somente para contratos", () => {
    expect(isActiveThirdPartyContract({ status: "andamento", active: false })).toBe(false);
    expect(isActiveThirdPartyContract({ status: "andamento", active: true })).toBe(true);
  });
});
