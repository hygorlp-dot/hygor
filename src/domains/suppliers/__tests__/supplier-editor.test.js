import { describe, expect, it } from "vitest";
import { supplierAdapter } from "../supplierAdapter.js";
import { supplierEditorSchema } from "../supplierEditorSchema.js";
import { validateSupplier } from "../supplierValidation.js";

describe("caracterização do editor de fornecedores", () => {
  it("mapeia os campos existentes e preserva id, categorias e campos desconhecidos", () => {
    const legacy = { id: "forn-1", nome: "Depósito Recife", cnpj: "12.345.678/0001-99", categorias: ["cimento"], ativo: true, campoAntigo: "manter" };
    const values = supplierAdapter.fromLegacy(legacy);
    expect(values).toMatchObject({ id: "forn-1", name: "Depósito Recife", document: "12.345.678/0001-99" });
    expect(values.categories).toEqual(["cimento"]);
    expect(supplierAdapter.toLegacy({ ...values, name: "Depósito Olinda" }, legacy)).toMatchObject({ id: "forn-1", nome: "Depósito Olinda", categorias: ["cimento"], ativo: true, campoAntigo: "manter" });
  });

  it("rejeita nome ausente sem criar novo formato de persistência", () => {
    expect(validateSupplier({ name: "" }).name).toBe("Informe o nome do fornecedor.");
    expect(validateSupplier({ name: "Fornecedor", email: "invalido" }).email).toBe("Informe um e-mail válido.");
  });

  it("usa apenas campos que existem no cadastro legado", () => {
    expect(supplierEditorSchema.fields.map(field => field.name)).toEqual(expect.arrayContaining(["name", "document", "corporateName", "tradeName", "contact", "phone", "email", "postalCode", "address", "addressNumber", "addressComplement", "neighborhood", "city", "state", "notes"]));
  });
});
