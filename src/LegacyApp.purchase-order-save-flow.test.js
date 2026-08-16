import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Compras foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-16 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #4).
const source = readFileSync(resolve(process.cwd(), "src/domains/compras/components/ComprasView.jsx"), "utf8");

describe("fluxo de criação do pedido a partir da solicitação", () => {
  it("não salva o status antes de o pedido ser confirmado pelo servidor", () => {
    const start = source.indexOf("const gerarPedidoSolicitacao=");
    const end = source.indexOf("const abrirCotacaoDaSolicitacao=", start);
    const implementation = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(implementation).toContain("setPedModal(");
    expect(implementation).not.toContain("atualizarStatusSolicitacao(");
    expect(source).toContain('type:OPERATIONAL_COMMAND.PURCHASE_ORDER_SAVED');
  });
});
