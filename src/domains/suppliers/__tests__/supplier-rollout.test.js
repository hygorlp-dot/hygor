import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { features } from "../../../config/features.js";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");
// Compras foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-16 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #4) - uma
// das 3 chamadas de <FornecedorEditorPilot mora lá agora.
const comprasSource = readFileSync(resolve(process.cwd(), "src/domains/compras/components/ComprasView.jsx"), "utf8");

describe("rollout seguro do editor de fornecedores", () => {
  it("mantém o novo editor desligado por padrão", () => {
    expect(features.newSupplierEditor).toBe(false);
  });

  it("mantém fallback para o modal legado e carrega o piloto sob demanda", () => {
    expect(source).toContain('lazy(() => import("./domains/suppliers/SupplierEditor")');
    expect(source).toContain("if (!features.newSupplierEditor) return <ModalFornecedor");
    const total=(source.match(/<FornecedorEditorPilot/g) || []).length
      + (comprasSource.match(/<FornecedorEditorPilot/g) || []).length;
    expect(total).toBe(3);
  });
});
