import { describe, expect, it } from "vitest";
import { createLegacyAdapter } from "./createLegacyAdapter.js";
import { normalizeEditorValues } from "./normalizeEditorValues.js";

describe("adaptadores legados", () => {
  it("preserva campos legados não editados", () => {
    const supplierAdapter = createLegacyAdapter({ fromLegacy: record => ({ name: record.nome || "" }), toLegacy: values => ({ nome: values.name }) });
    const original = { id: "1", nome: "Fornecedor", campoAntigo: "preservar" };
    expect(supplierAdapter.toLegacy({ name: "Novo nome" }, original)).toEqual({ id: "1", nome: "Novo nome", campoAntigo: "preservar" });
  });

  it("normaliza apenas valores conhecidos pelo schema", () => {
    expect(normalizeEditorValues({ valor: "12.5", nome: "Areia", antigo: "preservar" }, { fields: [{ name: "valor", type: "currency" }, { name: "nome", type: "text" }] })).toEqual({ valor: 12.5, nome: "Areia" });
  });
});
