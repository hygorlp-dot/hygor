import { describe, expect, it } from "vitest";
import { mapaGerencialCompras } from "./calculations.js";
import { FILTROS_PEDIDOS_VAZIOS, filtrarPedidos, filtrosPedidosAtivos } from "./order-list.js";

// R5: cada exceção do painel diz como abrir a lista já filtrada.
const data = () => ({
  obras: [{ id: "o1" }],
  fornecedores: [{ id: "f1", nome: "Fornecedor 1" }],
  solicitacoesCompra: [], cotacoes: [{ id: "c1", obraId: "o1", propostas: [{}, {}] }],
  pedidos: [
    { id: "atrasado", obraId: "o1", fornecedorId: "f1", status: "enviado", previsao: "2026-07-20",
      itens: [{ qtd: 2, precoUnit: 50, qtdRecebida: 0 }], pagamentos: [] },
    { id: "sem-data", obraId: "o1", fornecedorId: "f1", status: "enviado", cotacaoId: "c1",
      itens: [{ qtd: 1, precoUnit: 10, qtdRecebida: 0 }], pagamentos: [{ id: "pg", valor: 10, conciliado: false }] },
    { id: "recebido", obraId: "o1", fornecedorId: "f1", status: "enviado", cotacaoId: "c1", previsao: "2026-07-30",
      itens: [{ qtd: 1, precoUnit: 30, qtdRecebida: 1 }], pagamentos: [] },
  ],
});

describe("exceções do painel abrem a lista já filtrada (R5)", () => {
  const alertas = mapaGerencialCompras(data(), ["o1"], "2026-07-23").alertas;
  const porTitulo = trecho => alertas.find(a => a.titulo.includes(trecho));

  it("entregas atrasadas vão para Pedidos com 'só atrasados'", () => {
    expect(porTitulo("entrega(s) atrasada(s)").filtro).toEqual({ area: "pedidos", pedidos: { atrasados: true } });
  });

  it("exceções de pedidos levam a lista exata de pedidos", () => {
    expect(porTitulo("sem previsão").filtro).toEqual({ area: "pedidos", pedidos: { ids: ["sem-data"] } });
    expect(porTitulo("sem concorrência").filtro).toEqual({ area: "pedidos", pedidos: { ids: ["atrasado"] } });
    expect(porTitulo("recebimento(s) sem quitação").filtro).toEqual({ area: "pedidos", pedidos: { ids: ["recebido"] } });
  });

  it("exceções financeiras abrem o Financeiro no filtro certo", () => {
    expect(porTitulo("a pagar").filtro).toEqual({ area: "financeiro", financeiro: "pendentes" });
    expect(porTitulo("sem conciliação").filtro).toEqual({ area: "financeiro", financeiro: "nao_conciliados" });
  });

  it("toda exceção sobre pedidos ou pagamentos tem filtro", () => {
    for (const alerta of alertas.filter(a => a.destino !== "forn")) expect(alerta.filtro, alerta.titulo).toBeTruthy();
  });

  it("o filtro por ids mostra só os pedidos da exceção e conta como filtro ativo", () => {
    const pedidos = data().pedidos;
    expect(filtrarPedidos(pedidos, { ...FILTROS_PEDIDOS_VAZIOS, ids: ["sem-data", "recebido"] }).map(p => p.id)).toEqual(["sem-data", "recebido"]);
    expect(filtrarPedidos(pedidos, { ...FILTROS_PEDIDOS_VAZIOS, ids: [] })).toEqual([]);
    expect(filtrarPedidos(pedidos, FILTROS_PEDIDOS_VAZIOS)).toHaveLength(3);
    expect(filtrosPedidosAtivos({ ...FILTROS_PEDIDOS_VAZIOS, ids: ["x"], origem: "Exceção" })).toBe(true);
    expect(filtrosPedidosAtivos(FILTROS_PEDIDOS_VAZIOS)).toBe(false);
  });
});
