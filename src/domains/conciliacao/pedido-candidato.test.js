import { describe, expect, it } from "vitest";
import { criarIndicesFinanceiros } from "./selectors.js";
import { gerarCandidatosConciliacao } from "./matching.js";

// O pedido de compra não guarda `totalPedido`: o total é a soma dos itens
// (compras/calculations.js). O extrato lia o campo inexistente, o saldo ficava
// em zero e o pedido nunca aparecia como candidato de um débito.
const pedido = (patch = {}) => ({
  id: "p-1", numero: "PC-001", obraId: "o-1", fornecedorId: "f-1", status: "enviado", pagamentos: [],
  itens: [{ id: "i-1", materialId: "m-1", qtd: 100, precoUnit: 35 }], ...patch,
});
const dataCom = pedidos => ({
  notasFiscais: [], pedidos, medicoes: [], medicoesTerc: [], terceirizados: [], employees: [],
  caixaObra: [], transacoes: [], titulosFolha: [], fornecedores: [], contasBancarias: [],
});
const debito = (valor, patch = {}) => ({ id: "t-1", data: "2026-10-10", valor: -valor, descricao: "TED CIMENTOS", status: "pendente", ...patch });
const candidatosDe = (data, transacao) => gerarCandidatosConciliacao(transacao, data, criarIndicesFinanceiros(data));

describe("pedido de compra como candidato do extrato", () => {
  it("entra no índice por valor com o total dos itens", () => {
    const indices = criarIndicesFinanceiros(dataCom([pedido()]));
    const porValor = indices.porValorCentavos.get(350000) || [];
    expect(porValor.some(entrada => entrada.tipo === "pedido")).toBe(true);
  });

  it("o saldo desconta só pagamentos ativos", () => {
    const data = dataCom([pedido({ pagamentos: [
      { id: "pg-1", valor: 1000, status: "ativo" },
      { id: "pg-2", valor: 500, status: "estornado" },
    ] })]);
    const indices = criarIndicesFinanceiros(data);
    expect((indices.porValorCentavos.get(250000) || []).some(entrada => entrada.tipo === "pedido")).toBe(true);
  });

  it("um débito do mesmo valor sugere o pedido e permite registrar o pagamento", () => {
    const data = dataCom([pedido()]);
    const candidatos = candidatosDe(data, debito(3500));
    const doPedido = (candidatos.candidatos || candidatos).filter(item => item.tipo === "pedido");
    expect(doPedido.length).toBeGreaterThan(0);
    expect(doPedido[0].podeRegistrarPagamento).toBe(true);
  });

  it("pedido cancelado e pedido já quitado não são candidatos", () => {
    const cancelado = candidatosDe(dataCom([pedido({ status: "cancelado" })]), debito(3500));
    expect((cancelado.candidatos || cancelado).some(item => item.tipo === "pedido")).toBe(false);
    const quitado = candidatosDe(dataCom([pedido({ pagamentos: [{ id: "pg-1", valor: 3500, status: "ativo" }] })]), debito(3500));
    expect((quitado.candidatos || quitado).some(item => item.tipo === "pedido" && item.podeRegistrarPagamento)).toBe(false);
  });
});
