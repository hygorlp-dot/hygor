import { describe, expect, it } from "vitest";
import { inicioDaSemana, painelAdocaoCompras, SEM_AUTOR } from "./adoption.js";

// Hoje é quarta, 28/10/2026: a janela de 8 semanas começa na segunda 07/09.
const HOJE = "2026-10-28";
const rec = (data, responsavel, registradoEm) => ({ data, responsavel, responsavelId: responsavel, registradoEm });
const base = () => ({
  obras: [{ id: "a", name: "Alameda" }, { id: "b", name: "Horizonte" }, { id: "c", name: "Vista" }],
  solicitacoesCompra: [
    { id: "s1", obraId: "a", status: "pedido_gerado", criadoEm: "2026-10-19T10:00:00Z", criadoPor: "Ana" },
    { id: "s2", obraId: "a", status: "enviada", criadoEm: "2026-10-27T10:00:00Z", criadoPor: "Ana" },
    { id: "s3", obraId: "a", status: "rascunho", criadoEm: "2026-10-27T10:00:00Z", criadoPor: "Ana" },
    // Fora da janela (antes de 07/09).
    { id: "s0", obraId: "a", status: "enviada", criadoEm: "2026-09-01T10:00:00Z", criadoPor: "Ana" },
  ],
  cotacoes: [{ id: "c1", obraId: "a", data: "2026-10-20" }],
  pedidos: [
    { id: "p1", obraId: "a", solicitacaoId: "s1", status: "recebido", data: "2026-10-22", criadoEm: "2026-10-22T09:00:00Z", criadoPor: "Bruno",
      itens: [
        // Uma chegada com dois itens conta como um recebimento.
        { id: "i1", recebimentos: [rec("2026-10-26", "Carlos", "2026-10-26T15:00:00Z")] },
        { id: "i2", recebimentos: [rec("2026-10-26", "Carlos", "2026-10-26T15:00:00Z")] },
      ] },
    { id: "p2", obraId: "b", status: "enviado", data: "2026-09-10", itens: [{ id: "i3", recebimentos: [] }] },
    { id: "p3", obraId: "b", status: "rascunho", data: "2026-10-27", itens: [] },
  ],
  notasFiscais: [
    { id: "n1", obraId: "a", pedidoId: "p1", numero: "10", emissao: "2026-10-26", criadoEm: "2026-10-27T08:00:00Z", criadoPor: "Bruno", valorBruto: 500 },
    { id: "n2", obraId: "b", numero: "77", emissao: "2026-10-15", valorBruto: 1200, categoria: "material" },
    { id: "n3", obraId: "b", numero: "78", emissao: "2026-10-15", valorBruto: 900, medicaoTercId: "m1" },
    { id: "n4", obraId: "b", numero: "79", emissao: "2026-10-15", valorBruto: 300, status: "cancelada" },
  ],
  caixaObra: [
    { id: "k1", obraId: "a", tipo: "despesa", categoria: "material", data: "2026-10-21", valor: 80, descricao: "Areia na loja", registradoPor: "Carlos" },
    { id: "k2", obraId: "a", tipo: "despesa", categoria: "material", data: "2026-10-21", valor: 400, pedidoId: "p1" },
    { id: "k3", obraId: "a", tipo: "despesa", categoria: "alimentacao", data: "2026-10-21", valor: 60 },
  ],
});

describe("painel de adoção de Compras (A0.1)", () => {
  const painel = painelAdocaoCompras(base(), ["a", "b", "c"], HOJE);

  it("monta 8 semanas de segunda a domingo terminando na semana de hoje", () => {
    expect(inicioDaSemana(HOJE)).toBe("2026-10-26");
    expect(painel.semanas).toHaveLength(8);
    expect(painel.semanas[0]).toEqual({ inicio: "2026-09-07", fim: "2026-09-13" });
    expect(painel.semanas[7]).toEqual({ inicio: "2026-10-26", fim: "2026-11-01" });
  });

  it("conta o que foi lançado por etapa e semana, sem rascunho e sem nada fora da janela", () => {
    expect(painel.totalPorEtapa).toEqual({ solicitacoes: 2, cotacoes: 1, pedidos: 2, recebimentos: 1, notas: 1 });
    expect(painel.totais.solicitacoes).toEqual([0, 0, 0, 0, 0, 0, 1, 1]);
    expect(painel.totais.pedidos).toEqual([1, 0, 0, 0, 0, 0, 1, 0]);
    expect(painel.totais.recebimentos).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("separa por obra, mais ativa primeiro, e aponta a obra que não lançou nada", () => {
    expect(painel.porObra.map(o => [o.nome, o.total, o.ultima])).toEqual([
      ["Alameda", 6, "2026-10-27"], ["Horizonte", 1, "2026-09-10"], ["Vista", 0, ""],
    ]);
    expect(painel.porObra[0].etapas).toEqual({ solicitacoes: 2, cotacoes: 1, pedidos: 1, recebimentos: 1, notas: 1 });
    expect(painel.obrasSemUso).toEqual(["c"]);
  });

  it("diz quem lançou; registro antigo sem autor aparece como tal", () => {
    expect(painel.autores.map(a => [a.nome, a.total])).toEqual([
      ["Ana", 2], ["Bruno", 2], [SEM_AUTOR, 2], ["Carlos", 1],
    ]);
    expect(painel.autores.find(a => a.nome === "Carlos")).toMatchObject({ recebimentos: 1, total: 1 });
  });

  it("mede o tempo médio da solicitação ao pedido e do pedido à entrega", () => {
    expect(painel.tempos).toEqual({
      solicitacaoAtePedido: { mediaDias: 3, amostra: 1 },
      pedidoAteEntrega: { mediaDias: 4, amostra: 1 },
    });
  });

  it("aponta compra fora do fluxo: nota de material sem pedido e caixa de material sem pedido nem nota", () => {
    expect(painel.foraDoFluxo.itens.map(i => [i.tipo, i.id, i.valor])).toEqual([
      ["caixa", "k1", 80], ["nota", "n2", 1200],
    ]);
    expect(painel.foraDoFluxo).toMatchObject({ quantidade: 2, valor: 1280 });
  });

  it("respeita as obras escolhidas", () => {
    const soB = painelAdocaoCompras(base(), ["b"], HOJE);
    expect(soB.total).toBe(1);
    expect(soB.foraDoFluxo.itens.map(i => i.id)).toEqual(["n2"]);
    expect(soB.autores).toEqual([expect.objectContaining({ nome: SEM_AUTOR, pedidos: 1 })]);
  });
});
