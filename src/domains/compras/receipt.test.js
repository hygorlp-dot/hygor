import { describe, expect, it } from "vitest";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "../sync/operational-commands.js";
import { montarRecebimento, quantidadesQueFaltam } from "./receipt.js";

const pedido = () => ({
  id: "p1", numero: "PC-1", obraId: "o1", fornecedorId: "f1", status: "enviado", version: 1, pagamentos: [],
  itens: [
    { id: "cim", materialId: "m-cim", qtd: 10, qtdRecebida: 4, precoUnit: 35, unidadeCompra: "SC", unidadeRef: "KG", fatorConversao: 50 },
    { id: "are", materialId: "m-are", qtd: 2, qtdRecebida: 0, precoUnit: 120, unidadeCompra: "M3", unidadeRef: "M3", fatorConversao: 1 },
  ],
});
let n = 0;
const opcoes = { quando: "2026-10-28", novoId: () => `id-${++n}`, descricao: "Chegada confirmada - pedido PC-1" };

describe("recebimento único (R6)", () => {
  it("'Chegou' sugere tudo o que falta de cada item", () => {
    expect(quantidadesQueFaltam(pedido())).toEqual({ cim: 6, are: 2 });
  });

  it("recebe tudo: converte para a unidade do cadastro e marca completo", () => {
    const r = montarRecebimento(pedido(), quantidadesQueFaltam(pedido()), opcoes);
    expect(r.ok).toBe(true);
    expect(r.completo).toBe(true);
    expect(r.receivedQuantities).toEqual({ cim: 6, are: 2 });
    expect(r.stockEntries.map(e => [e.pedidoItemId, e.qtd, e.qtdCompra, e.unidadeCompra, e.valorUnit])).toEqual([
      ["cim", 300, 6, "SC", 0.7], ["are", 2, 2, "M3", 120],
    ]);
    expect(r.stockEntries[0]).toMatchObject({ obraId: "o1", pedidoId: "p1", tipo: "entrada", data: "2026-10-28", descricao: "Chegada confirmada - pedido PC-1" });
  });

  it("recebe parcial: só o que chegou entra, e o pedido não fica completo", () => {
    const r = montarRecebimento(pedido(), { cim: 2, are: "" }, opcoes);
    expect(r.ok).toBe(true);
    expect(r.completo).toBe(false);
    expect(r.receivedQuantities).toEqual({ cim: 2 });
    expect(r.stockEntries).toHaveLength(1);
  });

  it("recusa excesso, quantidade inválida e recebimento vazio", () => {
    expect(montarRecebimento(pedido(), { cim: 7 }, opcoes)).toEqual({ ok: false, erro: "Só faltam 6.", itemId: "cim" });
    expect(montarRecebimento(pedido(), { are: -1 }, opcoes)).toMatchObject({ ok: false, itemId: "are" });
    expect(montarRecebimento(pedido(), { are: "abc" }, opcoes)).toMatchObject({ ok: false, itemId: "are" });
    expect(montarRecebimento(pedido(), { cim: 0, are: 0 }, opcoes)).toEqual({ ok: false, erro: "Informe ao menos uma quantidade recebida." });
  });

  it("o servidor aceita o recebimento montado, sem exigir pagamento", () => {
    const r = montarRecebimento(pedido(), { cim: 2 }, opcoes);
    const estado = { pedidos: [pedido()], movEstoque: [], materiais: [{ id: "m-cim" }, { id: "m-are" }] };
    const resultado = applyOperationalCommand(estado, {
      type: OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED, idempotencyKey: "pedido-recebimento-p1-teste-r6", expectedVersion: 1,
      actorId: "u1", actorName: "Obra", actorRole: "admin",
      payload: { pedidoId: "p1", receivedQuantities: r.receivedQuantities, stockEntries: r.stockEntries },
    });
    expect(resultado.ok, resultado.reason).toBe(true);
    expect(resultado.data.pedidos[0].itens[0].qtdRecebida).toBe(6);
    expect(resultado.data.movEstoque).toHaveLength(1);
  });
});
