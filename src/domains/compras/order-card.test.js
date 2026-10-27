import { describe, expect, it } from "vitest";
import { acoesDoPedido, filtrarPedidos, filtrosPedidoAtivos } from "./order-card.js";

const base = { podeEnviar: true, podeExcluir: true, temTelefone: true };

describe("ações do cartão de pedido (R4)", () => {
  it("rascunho: a ação principal é concluir a edição; cancelar e excluir ficam no menu", () => {
    expect(acoesDoPedido("rascunho", base)).toEqual({
      principal: "editar", comuns: [], menu: ["whatsapp"], destrutivas: ["cancelar", "excluir"],
    });
  });

  it("pedido ainda não enviado ao fornecedor: enviar é a principal e não aparece de novo no menu", () => {
    const acoes = acoesDoPedido("enviado", { ...base, enviadoAoFornecedor: false });
    expect(acoes.principal).toBe("enviar");
    expect(acoes.comuns).toEqual(["receber", "editar"]);
    expect(acoes.menu).toEqual(["registrar_aceite", "whatsapp"]);
  });

  it("pedido já enviado: receber é a principal e o envio vira 'reenviar' no menu", () => {
    const acoes = acoesDoPedido("parcial", { ...base, enviadoAoFornecedor: true, aceito: true });
    expect(acoes.principal).toBe("receber");
    expect(acoes.comuns).toEqual(["editar"]);
    expect(acoes.menu).toEqual(["reenviar", "whatsapp"]);
  });

  it("entrega atrasada com telefone: cobrar é a principal; sem telefone, volta a receber", () => {
    expect(acoesDoPedido("enviado", { ...base, enviadoAoFornecedor: true, atrasado: true }).principal).toBe("cobrar");
    expect(acoesDoPedido("enviado", { ...base, enviadoAoFornecedor: true, atrasado: true, temTelefone: false }).principal).toBe("receber");
  });

  it("quem não envia pedido não vê enviar nem aceite; saldo em aberto aparece quando falta pagar", () => {
    const acoes = acoesDoPedido("enviado", { podeExcluir: false, liberadoParaReceber: false });
    expect(acoes).toEqual({ principal: "receber", comuns: ["editar", "saldo"], menu: [], destrutivas: ["cancelar"] });
  });

  it("recebido e cancelado não têm ação principal; excluir só para quem pode", () => {
    expect(acoesDoPedido("recebido", base)).toEqual({ principal: null, comuns: [], menu: [], destrutivas: ["excluir"] });
    expect(acoesDoPedido("cancelado", { podeExcluir: false })).toEqual({ principal: null, comuns: [], menu: [], destrutivas: [] });
  });

  it("nunca há mais de uma principal, e destrutivas nunca ficam entre as comuns", () => {
    for (const status of ["rascunho", "enviado", "parcial", "recebido", "cancelado"]) {
      for (const atrasado of [false, true]) for (const enviadoAoFornecedor of [false, true]) {
        const acoes = acoesDoPedido(status, { ...base, atrasado, enviadoAoFornecedor });
        const visiveis = [acoes.principal, ...acoes.comuns].filter(Boolean);
        expect(visiveis).not.toContain("cancelar");
        expect(visiveis).not.toContain("excluir");
        expect(new Set([...visiveis, ...acoes.menu]).size).toBe(visiveis.length + acoes.menu.length);
      }
    }
  });
});

describe("filtros da lista de pedidos (R4)", () => {
  const pedidos = [
    { id: "a", obraId: "o1", fornecedorId: "f1", status: "enviado", itens: [{ qtd: 10, qtdRecebida: 0 }] },
    { id: "b", obraId: "o1", fornecedorId: "f2", status: "enviado", itens: [{ qtd: 10, qtdRecebida: 10 }] },
    { id: "c", obraId: "o2", fornecedorId: "f1", status: "rascunho", itens: [{ qtd: 1 }] },
    { id: "d", obraId: "o2", fornecedorId: "f1", status: "enviado", itens: [{ qtd: 10, qtdRecebida: 4 }] },
  ];
  const atraso = { a: { diasAtraso: 3 }, d: { diasAtraso: 1 } };

  it("filtra pela situação derivada, não pela gravada", () => {
    expect(filtrarPedidos(pedidos, { status: "recebido" }).map(p => p.id)).toEqual(["b"]);
    expect(filtrarPedidos(pedidos, { status: "parcial" }).map(p => p.id)).toEqual(["d"]);
  });

  it("combina fornecedor, obra e atraso", () => {
    expect(filtrarPedidos(pedidos, { fornecedorId: "f1", atraso: "atrasados" }, atraso).map(p => p.id)).toEqual(["a", "d"]);
    expect(filtrarPedidos(pedidos, { fornecedorId: "f1", obraId: "o2" }, atraso).map(p => p.id)).toEqual(["c", "d"]);
    expect(filtrarPedidos(pedidos, {}, atraso)).toHaveLength(4);
    expect(filtrosPedidoAtivos({ status: "enviado", fornecedorId: "", atraso: "atrasados", obraId: "" })).toBe(2);
  });
});
