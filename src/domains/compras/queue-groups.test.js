import { describe, expect, it } from "vitest";
import { buildPurchaseWorkspace } from "./workspace.js";
import { agruparFilaCompras, mensagemCobrancaFornecedor, resumoDaFila, SEM_FORNECEDOR } from "./queue-groups.js";

const item = (id, qtd = 10, precoUnit = 10) => ({ id, materialId: "m", qtd, precoUnit, qtdRecebida: 0 });
const data = () => ({
  obras: [{ id: "a", name: "Alameda" }, { id: "b", name: "Horizonte" }],
  materiais: [{ id: "m", descricao: "CIMENTO" }],
  fornecedores: [{ id: "central", nome: "Depósito Central" }, { id: "norte", nome: "Materiais Norte" }],
  solicitacoesCompra: [{ id: "s1", numero: "SC-1", obraId: "a", status: "enviada", necessidade: "2026-10-30", itens: [{ descricaoRef: "Areia" }] }],
  pedidos: [
    // Três entregas atrasadas do mesmo fornecedor, em duas obras.
    { id: "p1", numero: "PC-1", obraId: "a", fornecedorId: "central", status: "enviado", data: "2026-10-01", previsao: "2026-10-20", itens: [item("1")] },
    { id: "p2", numero: "PC-2", obraId: "b", fornecedorId: "central", status: "enviado", data: "2026-10-01", previsao: "2026-10-21", itens: [item("2", 5, 20)] },
    { id: "p3", numero: "PC-3", obraId: "a", fornecedorId: "central", status: "enviado", data: "2026-10-01", previsao: "2026-10-22", itens: [item("3", 1, 300)] },
    { id: "p4", numero: "PC-4", obraId: "b", fornecedorId: "norte", status: "enviado", data: "2026-10-01", previsao: "2026-11-30", itens: [item("4", 100, 10)] },
  ],
});

describe("fila de compras agrupada (R7)", () => {
  const model = buildPurchaseWorkspace(data(), ["a", "b"], "2026-10-28");
  const nome = id => data().fornecedores.find(f => f.id === id)?.nome;

  it("agrupa por fornecedor: as três entregas atrasadas do mesmo fornecedor ficam juntas, com valor em R$", () => {
    const grupos = agruparFilaCompras(model.rows, "fornecedor", nome);
    expect(grupos.map(g => [g.rotulo, g.quantidade, g.atrasados, g.valor, g.valorAtrasado])).toEqual([
      ["Depósito Central", 3, 3, 500, 500],
      ["Materiais Norte", 1, 0, 1000, 0],
      ["Sem fornecedor definido", 1, 0, 0, 0],
    ]);
    expect(grupos[0].linhas.map(l => l.code)).toEqual(["PC-1", "PC-2", "PC-3"]);
    expect(grupos[2].chave).toBe(SEM_FORNECEDOR);
  });

  it("agrupa por obra, com o mais atrasado primeiro", () => {
    const grupos = agruparFilaCompras(model.rows, "obra", nome);
    expect(grupos.map(g => [g.rotulo, g.quantidade, g.atrasados, g.valor])).toEqual([
      ["Alameda", 3, 2, 400],
      ["Horizonte", 2, 1, 1100],
    ]);
  });

  it("sem agrupamento válido devolve lista vazia; o resumo soma valor e atrasos", () => {
    expect(agruparFilaCompras(model.rows, "", nome)).toEqual([]);
    expect(resumoDaFila(model.rows)).toEqual({ quantidade: 5, valor: 1500, atrasados: 3, valorAtrasado: 500 });
  });

  it("monta uma só mensagem de cobrança com todos os pedidos atrasados do fornecedor", () => {
    const texto = mensagemCobrancaFornecedor({
      empresa: "MARCELL", fornecedorNome: "Depósito Central",
      pedidos: [
        { numero: "PC-1", obra: "Alameda", previsao: "20/10/2026", diasAtraso: 8, itens: [{ descricao: "CIMENTO", falta: 10, unidade: "SC" }] },
        { numero: "PC-2", obra: "Horizonte", previsao: "21/10/2026", diasAtraso: 7, itens: [] },
      ],
    });
    expect(texto).toContain("Ola, Depósito! Tudo bem?");
    expect(texto).toContain("2 pedidos atrasados");
    expect(texto).toContain("Pedido PC-1 (obra Alameda): entrega combinada para 20/10/2026, 8 dia(s) de atraso.\n  - CIMENTO: falta 10 SC");
    expect(texto).toContain("Pedido PC-2 (obra Horizonte)");
    expect(texto.endsWith("Obrigado!\nMARCELL")).toBe(true);
  });
});
