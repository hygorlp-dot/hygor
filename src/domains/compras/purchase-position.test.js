import { describe, expect, it } from "vitest";
import { faturadoDoPedido, pedidoVivo, posicaoDasCompras, posicaoDoPedido, valorBrutoDoPedido } from "./purchase-position.js";
import { mapaGerencialCompras, totalPedido } from "./calculations.js";
import { buildPurchasesByWork } from "./by-work.js";
import { calcOrcadoComprado } from "./budget-tracking.js";
import { buildFinancialLedger, selectCommitments } from "../financeiro/ledger.js";

const pedido = (id, status, qtd, extra = {}) => ({
  id, numero: id.toUpperCase(), obraId: "o1", status, fornecedorId: "f1",
  itens: [{ id: `${id}-i`, materialId: "m", qtd, precoUnit: 100, qtdRecebida: 0, ...(extra.item || {}) }],
  pagamentos: extra.pagamentos || [],
});
const nota = (id, pedidoId, valor, status = "recebida") => ({ id, pedidoId, valorBruto: valor, status, obraId: "o1", emissao: "2026-10-05" });

describe("posição da compra (D-B): uma definição de comprometido", () => {
  it("só pedido enviado é vivo: rascunho, cancelado e excluído não comprometem", () => {
    expect(pedidoVivo(pedido("a", "enviado", 1))).toBe(true);
    expect(pedidoVivo(pedido("a", "rascunho", 1))).toBe(false);
    expect(pedidoVivo(pedido("a", "cancelado", 1))).toBe(false);
    expect(pedidoVivo({ ...pedido("a", "enviado", 1), deletedAt: "2026-10-01" })).toBe(false);
    expect(pedidoVivo(null)).toBe(false);
  });

  it("totalPedido e o valor bruto são o mesmo número", () => {
    const p = pedido("a", "enviado", 7);
    expect(totalPedido(p)).toBe(700);
    expect(valorBrutoDoPedido(p)).toBe(700);
  });

  it("a faturar = comprometido - notas que o razão reconhece, limitado ao pedido", () => {
    const p = pedido("a", "enviado", 10);
    expect(posicaoDoPedido(p, [])).toMatchObject({ comprometido: 1000, faturado: 0, aFaturar: 1000 });
    expect(posicaoDoPedido(p, [nota("n1", "a", 400)])).toMatchObject({ faturado: 400, aFaturar: 600 });
    // nota maior que o pedido não gera "a faturar" negativo
    expect(posicaoDoPedido(p, [nota("n1", "a", 1500)])).toMatchObject({ faturado: 1000, aFaturar: 0 });
  });

  it("nota rejeitada, cancelada, rascunho ou de outro pedido não fatura o pedido", () => {
    const p = pedido("a", "enviado", 10);
    const notas = [nota("n1", "a", 400, "rejeitada"), nota("n2", "a", 300, "cancelada"), nota("n3", "a", 200, "rascunho"), nota("n4", "b", 500)];
    expect(faturadoDoPedido(p, notas)).toBe(0);
    expect(posicaoDoPedido(p, notas).aFaturar).toBe(1000);
  });

  it("rascunho não tem posição", () => {
    expect(posicaoDoPedido(pedido("a", "rascunho", 10), [nota("n1", "a", 400)])).toEqual({ viva: false, comprometido: 0, faturado: 0, aFaturar: 0 });
  });

  it("soma a carteira", () => {
    const lista = [pedido("a", "enviado", 10), pedido("b", "enviado", 5), pedido("c", "rascunho", 99), pedido("d", "cancelado", 99)];
    expect(posicaoDasCompras(lista, [nota("n1", "a", 400)])).toEqual({ comprometido: 1500, faturado: 400, aFaturar: 1100 });
  });
});

describe("as telas de compras mostram o mesmo comprometido (D-B)", () => {
  const dados = () => ({
    obras: [{ id: "o1", name: "Obra 1" }],
    materiais: [{ id: "m", descricao: "Material", unidade: "UN" }],
    fornecedores: [{ id: "f1", nome: "Fornecedor" }],
    solicitacoesCompra: [], cotacoes: [], instanciasAprovacao: [],
    notasFiscais: [nota("n1", "p1", 400)],
    pedidos: [pedido("p1", "enviado", 10), pedido("p2", "enviado", 5), pedido("p3", "rascunho", 99), pedido("p4", "cancelado", 50)],
  });

  it("o mapa gerencial não soma rascunho e informa o que falta faturar", () => {
    const mapa = mapaGerencialCompras(dados(), ["o1"], "2026-10-26");
    expect(mapa.totalComprometido).toBe(1500);
    expect(mapa.totalAFaturar).toBe(1100);
  });

  it("o mapa não conta o saldo a pagar do rascunho", () => {
    const comRascunho = dados();
    const mapa = mapaGerencialCompras(comRascunho, ["o1"], "2026-10-26");
    expect(mapa.totalPendente).toBe(1500);
  });

  it("Compras por obra (sem orçamento de controle) bate com o mapa", () => {
    const d = dados();
    const mapa = mapaGerencialCompras(d, ["o1"], "2026-10-26");
    const porObra = buildPurchasesByWork(d, d.obras, "2026-10-26");
    expect(porObra.linhas.find(l => l.obraId === "o1").comprometido).toBe(mapa.totalComprometido);
  });

  it("Orçado × comprado põe o rascunho em 'previsto' e não em 'comprometido'", () => {
    const d = dados();
    d.orcamentos = [{ id: "b", obraId: "o1", etapas: [{ id: "e", nome: "Etapa", ordem: 1 }], itens: [{ id: "bi", etapaId: "e", quantidade: 1, precoUnit: 10000 }] }];
    d.budgetBaselines = [{ obraId: "o1", tipo: "controle", ativo: true, budgetId: "b" }];
    d.pedidos.forEach(p => { p.itens[0].orcNivel1Id = "e"; });
    const controle = calcOrcadoComprado(d, "o1");
    const comprometido = controle.linhas.reduce((s, l) => s + l.comprometido, 0) + controle.semApropriacao;
    expect(comprometido).toBe(1500);
  });
});

describe("o 'a faturar' das telas bate com o compromisso do razão (contrato D-B)", () => {
  it("para pedidos enviados e notas reconhecidas, aFaturar == selectCommitments do razão", () => {
    const dados = {
      obras: [{ id: "o1", name: "Obra 1" }],
      fornecedores: [{ id: "f1", nome: "Fornecedor" }],
      pedidos: [
        { ...pedido("p1", "enviado", 10), data: "2026-10-05" },
        { ...pedido("p2", "enviado", 5), data: "2026-10-06" },
        { ...pedido("p3", "rascunho", 99), data: "2026-10-06" },
        { ...pedido("p4", "cancelado", 40), data: "2026-10-06" },
      ],
      notasFiscais: [nota("n1", "p1", 400), nota("n2", "p2", 800, "rejeitada")],
    };
    const posicao = posicaoDasCompras(dados.pedidos, dados.notasFiscais);
    const razao = selectCommitments(buildFinancialLedger(dados), { obraId: "o1", endDate: "2026-12-31" });
    expect(Math.round(posicao.aFaturar * 100)).toBe(razao.balanceCents);
  });
});
