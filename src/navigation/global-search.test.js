import { describe, expect, it } from "vitest";
import { buildGlobalSearchIndex, searchGlobalIndex } from "./global-search.js";

describe("busca global", () => {
  it("indexa nomes, números e destinos e omite cadastros inativos", () => {
    const index = buildGlobalSearchIndex({
      obras: [{ id: "o1", name: "Obra Centro", engineer: "Ana" }],
      employees: [{ name: "Inativo", active: false }],
      equipamentos: [{ nome: "Máquina inativa", ativo: false }],
      pedidos: [{ numero: 10, fornecedor: "Casa de Materiais" }, {}],
      comercial: { propostas: [{ titulo: "Projeto piloto" }], contratos: [{}] },
    }, { fin: { label: "Financeiro" } });
    expect(index).toEqual([
      { tipo: "Obra", rotulo: "Obra Centro", sub: "Ana", tabId: "obras", obraId: "o1" },
      { tipo: "Pedido", rotulo: "Pedido 10", sub: "Casa de Materiais", tabId: "cmp", obraId: "" },
      { tipo: "Pedido", rotulo: "Pedido", sub: "", tabId: "cmp", obraId: "" },
      { tipo: "Proposta", rotulo: "Projeto piloto", sub: "", tabId: "com_propostas", obraId: "" },
      { tipo: "Contrato", rotulo: "Contrato", sub: "", tabId: "com_contratos", obraId: "" },
      { tipo: "Tela", rotulo: "Financeiro", sub: "abrir tela", tabId: "fin", obraId: "" },
    ]);
  });

  it("filtra abas autorizadas, busca também no subtítulo e preserva a prioridade", () => {
    const index = buildGlobalSearchIndex({
      obras: [{ id: "o1", name: "Centro 2" }, { id: "o2", name: "Bairro Norte", address: "Centro" }],
      comercial: { clientes: [{ nome: "Centro restrito" }] },
    }, { dre: { label: "Centro de custos" } });
    const result = searchGlobalIndex(index, "centro", ["obras", "dre"]);
    expect(result.map(row => row.rotulo)).toEqual(["Centro 2", "Centro de custos", "Bairro Norte"]);
    expect(searchGlobalIndex(index, "", ["obras"])).toEqual([]);
  });

  it("limita a resposta a 20 resultados sem alterar o índice", () => {
    const index = buildGlobalSearchIndex({
      pedidos: Array.from({ length: 25 }, (_, i) => ({ numero: String(25 - i).padStart(2, "0") })),
    }, {});
    expect(searchGlobalIndex(index, "pedido", ["cmp"]).map(row => row.rotulo)).toEqual(
      Array.from({ length: 20 }, (_, i) => `Pedido ${String(i + 1).padStart(2, "0")}`),
    );
    expect(index[0].rotulo).toBe("Pedido 25");
    expect(buildGlobalSearchIndex(null, {})).toEqual([]);
  });
});
