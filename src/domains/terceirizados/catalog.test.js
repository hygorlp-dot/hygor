import { describe, expect, it } from "vitest";
import {
  THIRD_PARTY_DOCUMENT_TYPES,
  THIRD_PARTY_SPECIALTIES,
  THIRD_PARTY_SUGGESTED_STAGES,
  thirdPartyDocumentType,
  thirdPartySpecialty,
} from "./catalog";

describe("catálogo de terceirizados", () => {
  it("não possui códigos duplicados", () => {
    const specialties = THIRD_PARTY_SPECIALTIES.map(item => item.v);
    const documents = THIRD_PARTY_DOCUMENT_TYPES.map(item => item.v);
    expect(new Set(specialties).size).toBe(specialties.length);
    expect(new Set(documents).size).toBe(documents.length);
  });

  it("mantém fallback legível para registros legados", () => {
    expect(thirdPartySpecialty("legado").l).toBe("Outros");
    expect(thirdPartyDocumentType("LICENCA_LOCAL").l).toBe("LICENCA_LOCAL");
    expect(thirdPartyDocumentType("").l).toBe("Documento");
  });

  it("oferece etapas executáveis para cada especialidade", () => {
    for (const specialty of THIRD_PARTY_SPECIALTIES) {
      expect(THIRD_PARTY_SUGGESTED_STAGES[specialty.v]?.length).toBeGreaterThan(0);
    }
  });
});
