import { normalizeReferenceCode, referenceCodeVariants } from "../server/reference-code";

describe("códigos das bases de referência", () => {
  test("normaliza códigos numéricos sem alterar códigos próprios", () => {
    expect(normalizeReferenceCode("000123.0 / SINAPI")).toBe("123");
    expect(normalizeReferenceCode("ARCD-001")).toBe("ARCD-001");
  });

  test("consulta também o formato legado com zeros à esquerda", () => {
    const variants = referenceCodeVariants("123");
    expect(variants).toContain("123");
    expect(variants).toContain("000123");
  });
});
