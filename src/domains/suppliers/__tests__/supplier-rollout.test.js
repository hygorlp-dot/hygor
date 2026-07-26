import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { features } from "../../../config/features.js";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("rollout seguro do editor de fornecedores", () => {
  it("mantém o novo editor desligado por padrão", () => {
    expect(features.newSupplierEditor).toBe(false);
  });

  it("mantém fallback para o modal legado e carrega o piloto sob demanda", () => {
    expect(source).toContain('lazy(() => import("./domains/suppliers/SupplierEditor")');
    expect(source).toContain("if (!features.newSupplierEditor) return <ModalFornecedor");
    expect((source.match(/<FornecedorEditorPilot/g) || []).length).toBe(3);
  });
});
