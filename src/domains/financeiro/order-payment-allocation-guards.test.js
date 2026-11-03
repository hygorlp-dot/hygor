import { describe, expect, it } from "vitest";
import { applyPurchaseCancellationCommand, PURCHASE_CANCELLATION_COMMAND } from "../compras/purchase-cancellation-command.js";
import { desfazerConciliacao } from "../conciliacao/mutations.js";

// Adiantamento de pedido alocado a uma nota: o pagamento original do pedido
// não pode ser estornado por fora (cancelar a compra, desfazer a conciliação)
// enquanto a alocação existir, senão a nota fica quitada e com saída de caixa
// sem pagamento por trás.
const now = "2026-07-28T16:00:00.000Z";
const actor = { id: "u-1", nome: "Ana" };
const data = ({ conciliado = false } = {}) => ({
  pedidos: [{
    id: "p-1", numero: "PC-01", obraId: "o-1", data: "2026-07-20", status: "recebido", version: 2,
    itens: [{ id: "i-1", qtd: 1, precoUnit: 1000, qtdRecebida: 0, recebimentos: [] }],
    pagamentos: [{ id: "pg-1", data: "2026-07-20", valor: 300, status: "ativo", version: 1, ...(conciliado ? { transacaoId: "t-1", conciliado: true } : {}) }],
  }],
  notasFiscais: [{
    id: "n-1", numero: "10", pedidoId: "p-1", obraId: "o-1", status: "aprovada", valor: 100, version: 1,
    pagamentos: [{ id: "al-1", data: "2026-07-21", valor: 100, status: "ativo", pedidoPagamentoId: "pg-1", ...(conciliado ? { transacaoId: "t-1" } : {}) }],
  }],
  obras: [{ id: "o-1" }],
  transacoes: conciliado ? [{ id: "t-1", data: "2026-07-20", valor: -300, status: "conciliado", gerados: [{ tipo: "pagamentoPedido", entidadeId: "p-1", id: "pg-1" }] }] : [],
});
const pedidoPago = result => result.pedidos[0].pagamentos[0].status;

describe("adiantamento alocado trava estornos por fora", () => {
  it("não cancela a compra enquanto houver adiantamento alocado a nota", () => {
    const result = applyPurchaseCancellationCommand(data(), {
      type: PURCHASE_CANCELLATION_COMMAND.PURCHASE_CANCELLED, expectedVersion: 2,
      actorId: actor.id, actorName: actor.nome, payload: { orderId: "p-1", reason: "Pedido duplicado" },
    }, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/alocações/);
  });

  it("não desfaz a conciliação do pagamento do pedido enquanto houver alocação", () => {
    const original = data({ conciliado: true });
    const { data: next, resumo } = desfazerConciliacao(original, "t-1", actor, "Banco errado");
    expect(resumo.ok).toBe(false);
    expect(resumo.motivo).toMatch(/alocações/);
    expect(pedidoPago(next)).toBe("ativo");
    expect(next.transacoes[0].status).toBe("conciliado");
  });
});
