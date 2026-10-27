import { describe, expect, it } from "vitest";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "../sync/operational-commands.js";
import { buildFinancialLedger, selectCashFlow, selectCommitments, selectDRE } from "../financeiro/ledger.js";
import { statusPedido } from "./calculations.js";

// Fluxo de uma compra de obra executado de ponta a ponta pelos redutores reais
// (os mesmos do navegador e de api/data.js), sem mock de regra de negócio.
// Cada teste prende um comportamento observado na rodada do pathfinder.
const now = "2026-10-26T12:00:00.000Z";
let seq = 0;
const run = (data, type, payload, expectedVersion, actorRole = "admin") => applyOperationalCommand(data, {
  type, payload, expectedVersion, now, actorId: "u-1", actorName: "Ana", actorRole,
  idempotencyKey: `fluxo-compra-${String(++seq).padStart(6, "0")}`,
});
const must = result => { expect(result.reason).toBeUndefined(); expect(result.ok).toBe(true); return result.data; };

const base = () => ({
  obras: [{ id: "o-1", name: "Obra 1", hasCaixa: true }],
  fornecedores: [{ id: "f-1", nome: "Cimentos SA" }],
  materiais: [{ id: "m-1", descricao: "Cimento", unidade: "SC", precoMedio: 35 }],
  pedidos: [], notasFiscais: [], caixaObra: [], transacoes: [], historicoConc: [],
  movEstoque: [], solicitacoesCompra: [], cotacoes: [], fechamentosFinanceiros: [],
});
const order = (patch = {}) => ({
  id: "p-1", numero: "PC-001", obraId: "o-1", fornecedorId: "f-1", data: "2026-10-05", previsao: "2026-10-12",
  status: "enviado", origemPagamento: "empresa",
  itens: [{ id: "i-1", materialId: "m-1", qtd: 100, precoUnit: 35, unidadeCompra: "SC", fatorConversao: 1 }],
  ...patch,
});
const receive = (data, qtd, key) => run(data, OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED, {
  pedidoId: "p-1", receivedQuantities: { "i-1": qtd },
  stockEntries: [{ id: `mv-${key}`, receiptId: `rc-${key}`, pedidoItemId: "i-1", pedidoId: "p-1", obraId: "o-1", materialId: "m-1", qtd, qtdCompra: qtd, valorUnit: 35, data: "2026-10-08" }],
}, data.pedidos[0].version);
const invoice = (data, patch = {}) => run(data, OPERATIONAL_COMMAND.INVOICE_SAVED, {
  invoice: {
    id: "nf-1", tipo: "nfe", numero: "900", obraId: "o-1", pedidoId: "p-1", fornecedorId: "f-1",
    emissao: "2026-10-20", vencimento: "2026-11-20", valorBruto: 5080, retencoes: {}, rateios: [], documentos: [], pagamentos: [], ...patch,
  },
}, 0);
const withOrder = () => must(run(base(), OPERATIONAL_COMMAND.PURCHASE_ORDER_SAVED, { order: order() }, 0));

describe("fluxo de uma compra de obra: pedido -> recebimento -> nota -> DRE", () => {
  it("S6: nota divergente vira custo e conta a pagar ao salvar, antes de aprovar", () => {
    let data = withOrder();
    data = must(receive(data, 60, "a"));
    data = must(invoice(data));
    const nf = data.notasFiscais[0];
    expect(nf.status).toBe("recebida");
    expect(nf.divergencias.length).toBeGreaterThan(0);
    const ledger = buildFinancialLedger(data);
    const dre = selectDRE(ledger, { obraId: "o-1", competence: "2026-10" });
    expect(dre.costs).toBe(5080);
    const payable = ledger.events.filter(event => event.effect === "payable_increase").reduce((sum, event) => sum + event.amountCents, 0);
    expect(payable).toBe(508000);
  });

  it("D-A: rejeitar a nota tira o custo do DRE e devolve o compromisso do pedido", () => {
    let data = must(receive(withOrder(), 60, "r"));
    data = must(invoice(data));
    expect(selectDRE(buildFinancialLedger(data), { obraId: "o-1", competence: "2026-10" }).costs).toBe(5080);
    data = must(run(data, OPERATIONAL_COMMAND.INVOICE_REJECTED, { invoiceId: "nf-1", reason: "Valor acima do pedido" }, data.notasFiscais[0].version));
    expect(data.notasFiscais[0]).toMatchObject({ status: "rejeitada", pedidoId: "p-1", motivoRejeicao: "Valor acima do pedido" });
    const ledger = buildFinancialLedger(data);
    expect(selectDRE(ledger, { obraId: "o-1", competence: "2026-10" }).costs).toBe(0);
    // sem nota reconhecida, o pedido volta a ser compromisso integral
    expect(selectCommitments(ledger, { obraId: "o-1", endDate: "2026-10-31" }).balanceCents).toBe(350000);
  });

  it("S5: o abatimento do compromisso leva a data do pedido, não a da nota", () => {
    let data = withOrder();
    data = must(invoice(data));
    const ledger = buildFinancialLedger(data);
    const antesDaNota = selectCommitments(ledger, { obraId: "o-1", endDate: "2026-10-10" });
    expect(antesDaNota.balanceCents).toBe(0);
    const depoisDaNota = selectCommitments(ledger, { obraId: "o-1", endDate: "2026-10-31" });
    expect(depoisDaNota.balanceCents).toBe(0);
    const decrease = ledger.events.find(event => event.effect === "commitment_decrease");
    expect(decrease.date).toBe("2026-10-05");
  });

  it("recebimento não gera fato financeiro: o razão não muda", () => {
    const before = buildFinancialLedger(withOrder());
    const after = buildFinancialLedger(must(receive(withOrder(), 60, "b")));
    expect(after.events.map(event => event.id)).toEqual(before.events.map(event => event.id));
  });

  it("pedido recebido por inteiro continua gravado como enviado; o status é derivado", () => {
    const data = must(receive(withOrder(), 100, "c"));
    expect(data.pedidos[0].status).toBe("enviado");
    expect(statusPedido(data.pedidos[0])).toBe("recebido");
  });

  it("estornar a entrada de estoque de um pedido reabre o recebimento (C9/D-F)", () => {
    let data = must(receive(withOrder(), 100, "d"));
    expect(statusPedido(data.pedidos[0])).toBe("recebido");
    data = must(run(data, OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_REVERSED, { movementId: "mv-d", reason: "lançado errado" }, 0));
    expect(data.movEstoque[0].status).toBe("estornado");
    const item = data.pedidos[0].itens[0];
    expect(item.qtdRecebida).toBe(0);
    expect(item.recebimentos).toEqual([]);
    // o recebimento estornado fica guardado, com motivo e autor
    expect(item.recebimentosEstornados).toHaveLength(1);
    expect(item.recebimentosEstornados[0]).toMatchObject({ id: "rc-d", qtd: 100, motivoEstorno: "lançado errado", movimentoEstoqueId: "mv-d" });
    expect(statusPedido(data.pedidos[0])).toBe("enviado");
    // e dá para receber de novo
    data = must(run(data, OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED, {
      pedidoId: "p-1", receivedQuantities: { "i-1": 100 },
      stockEntries: [{ id: "mv-d2", receiptId: "rc-d2", pedidoItemId: "i-1", pedidoId: "p-1", obraId: "o-1", materialId: "m-1", qtd: 100, qtdCompra: 100, valorUnit: 35, data: "2026-10-09" }],
    }, data.pedidos[0].version));
    expect(statusPedido(data.pedidos[0])).toBe("recebido");
  });

  it("estorno parcial devolve só a quantidade daquela entrada", () => {
    let data = must(receive(withOrder(), 60, "f"));
    data = must(receive(data, 40, "g"));
    data = must(run(data, OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_REVERSED, { movementId: "mv-g", reason: "conferência" }, 0));
    expect(data.pedidos[0].itens[0].qtdRecebida).toBe(60);
    expect(data.pedidos[0].itens[0].recebimentos.map(r => r.id)).toEqual(["rc-f"]);
    expect(statusPedido(data.pedidos[0])).toBe("parcial");
  });

  it("recusa estornar a entrada de um pedido que já tem nota fiscal ativa", () => {
    let data = must(receive(withOrder(), 100, "h"));
    data = must(invoice(data));
    const result = run(data, OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_REVERSED, { movementId: "mv-h", reason: "teste" }, 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("nota fiscal");
  });

  it("recusa estornar a entrada cujo material já foi consumido", () => {
    let data = must(receive(withOrder(), 100, "i"));
    data = must(run(data, OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_RECORDED, {
      movement: { id: "mv-uso", obraId: "o-1", materialId: "m-1", tipo: "consumo", qtd: 80, data: "2026-10-10" },
    }, 0));
    const result = run(data, OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_REVERSED, { movementId: "mv-i", reason: "teste" }, 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("consumida");
  });

  it("entrada manual (sem pedido) continua estornável e não mexe em pedido", () => {
    let data = withOrder();
    data = must(run(data, OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_RECORDED, {
      movement: { id: "mv-man", obraId: "o-1", materialId: "m-1", tipo: "entrada", qtd: 10, valorUnit: 30, data: "2026-10-10" },
    }, 0));
    data = must(run(data, OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_REVERSED, { movementId: "mv-man", reason: "digitado errado" }, 0));
    expect(data.movEstoque[0].status).toBe("estornado");
    expect(data.pedidos[0].itens[0].qtdRecebida ?? 0).toBe(0);
  });

  it("preço do item pode ser alterado depois do recebimento sem tocar no estoque", () => {
    let data = must(receive(withOrder(), 100, "e"));
    const edited = { ...data.pedidos[0], itens: [{ ...data.pedidos[0].itens[0], precoUnit: 50 }] };
    data = must(run(data, OPERATIONAL_COMMAND.PURCHASE_ORDER_SAVED, { order: edited, adjustmentReason: "reajuste" }, data.pedidos[0].version));
    expect(data.pedidos[0].itens[0].precoUnit).toBe(50);
    expect(data.movEstoque[0].valorUnit).toBe(35);
  });

  it("cancelar o pedido não cancela a nota: o custo continua no DRE", () => {
    let data = must(invoice(withOrder()));
    data = must(run(data, OPERATIONAL_COMMAND.PURCHASE_CANCELLED, { orderId: "p-1", reason: "Duplicado" }, data.pedidos[0].version));
    expect(data.pedidos[0].status).toBe("cancelado");
    expect(data.notasFiscais[0].pedidoId).toBe("");
    const dre = selectDRE(buildFinancialLedger(data), { obraId: "o-1", competence: "2026-10" });
    expect(dre.costs).toBe(5080);
  });
});

describe("fluxo de uma compra de obra: pagamento, caixa e origem", () => {
  const pay = (data, payload, role = "admin") => run(data, OPERATIONAL_COMMAND.PAYABLE_PAYMENT_RECORDED, {
    targetType: "pedido", targetId: "p-1", ...payload,
  }, data.pedidos[0].version, role);

  it("pagamento acima da tolerância sem recebimento nem nota exige adiantamento", () => {
    const data = withOrder();
    const payment = { id: "pg-1", data: "2026-10-10", valor: 1000, origem: "empresa", comprovantes: [] };
    expect(pay(data, { payment }).ok).toBe(false);
    expect(pay(data, { payment, adiantamento: true, motivoAdiantamento: "Sinal" }).ok).toBe(true);
  });

  it("cliente_direto entra como saída de caixa da empresa no razão", () => {
    const data = must(pay(withOrder(), {
      payment: { id: "pg-1", data: "2026-10-10", valor: 1000, origem: "cliente_direto", comprovantes: [] },
      adiantamento: true, motivoAdiantamento: "Sinal",
    }));
    const cash = selectCashFlow(buildFinancialLedger(data), { obraId: "o-1" });
    expect(cash.cashOut).toBe(1000);
  });

  it("pagamento de pedido sem nota não vira custo: só caixa, marcado como não alocado", () => {
    const data = must(pay(withOrder(), {
      payment: { id: "pg-1", data: "2026-10-10", valor: 1000, origem: "empresa", comprovantes: [] },
      adiantamento: true, motivoAdiantamento: "Sinal",
    }));
    const ledger = buildFinancialLedger(data);
    expect(selectDRE(ledger, { obraId: "o-1" }).costs).toBe(0);
    expect(ledger.issues.some(issue => issue.code === "PAYMENT_UNALLOCATED")).toBe(true);
  });
});
