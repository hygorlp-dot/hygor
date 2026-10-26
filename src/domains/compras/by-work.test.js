import { describe, expect, it } from "vitest";
import { buildPurchasesByWork } from "./by-work.js";
import { calcOrcadoComprado } from "./budget-tracking.js";

const HOJE = "2026-10-23";
const obras = [
  { id: "o-ok", name: "Obra no limite saudável" },
  { id: "o-atraso", name: "Obra com entrega atrasada" },
  { id: "o-estouro", name: "Obra que estourou" },
  { id: "o-sem-orc", name: "Obra sem orçamento" },
  { id: "o-sem-baseline", name: "Obra com orçamento sem baseline" },
];
const orcamento = (id, obraId, valor) => ({
  id, obraId, etapas: [{ id: `${id}-fund`, nome: "Fundação", ordem: 1 }],
  itens: [{ id: `${id}-i`, etapaId: `${id}-fund`, quantidade: 1, precoUnit: valor }],
});
const pedido = (id, obraId, status, qtd, extra = {}, etapa = null) => ({
  id, obraId, status, numero: id.toUpperCase(),
  itens: [{ id: `${id}-i`, materialId: "m", qtd, precoUnit: 100, qtdRecebida: extra.recebida || 0, ...(etapa ? { orcNivel1Id: etapa } : {}) }],
  ...(extra.previsao ? { previsao: extra.previsao } : {}), ...(extra.pagamentos ? { pagamentos: extra.pagamentos } : {}),
});
const data = () => ({
  obras,
  orcamentos: [
    orcamento("b-ok", "o-ok", 100000), orcamento("b-atraso", "o-atraso", 100000),
    orcamento("b-estouro", "o-estouro", 10000), orcamento("b-sem-baseline", "o-sem-baseline", 50000),
  ],
  budgetBaselines: [
    { obraId: "o-ok", tipo: "controle", ativo: true, budgetId: "b-ok" },
    { obraId: "o-atraso", tipo: "controle", ativo: true, budgetId: "b-atraso" },
    { obraId: "o-estouro", tipo: "controle", ativo: true, budgetId: "b-estouro" },
  ],
  materiais: [{ id: "m", descricao: "Material", unidade: "UN" }],
  solicitacoesCompra: [], cotacoes: [], instanciasAprovacao: [],
  pedidos: [
    pedido("p-ok-1", "o-ok", "enviado", 100, { previsao: "2026-11-30" }, "b-ok-fund"),           // 10.000 comprometidos
    pedido("p-ok-2", "o-ok", "rascunho", 50, {}, "b-ok-fund"),                                      // rascunho: fora
    pedido("p-atraso-1", "o-atraso", "enviado", 200, { previsao: "2026-10-10" }, "b-atraso-fund"),  // 20.000, atrasado
    pedido("p-atraso-2", "o-atraso", "parcial", 100, { recebida: 40, previsao: "2026-10-12" }, "b-atraso-fund"), // 10.000 (6.000 a receber)
    pedido("p-estouro-1", "o-estouro", "enviado", 150, { previsao: "2026-11-30" }, "b-estouro-fund"), // 15.000 > 10.000
    pedido("p-sem-orc-1", "o-sem-orc", "enviado", 30, { previsao: "2026-11-30" }),                  // 3.000, sem orçamento
    pedido("p-sem-baseline-1", "o-sem-baseline", "recebido", 10, { recebida: 10 }),                 // 1.000 recebido
    pedido("p-cancelado", "o-ok", "cancelado", 999, {}, "b-ok-fund"),
  ],
});

const por = (resultado, id) => resultado.linhas.find(linha => linha.obraId === id);

describe("compras por obra", () => {
  it("calcula orçado, comprometido, a receber e a pagar com a mesma valoração das telas por obra", () => {
    const r = buildPurchasesByWork(data(), obras, HOJE);
    expect(por(r, "o-ok")).toMatchObject({ temControle: true, orcado: 100000, comprometido: 10000, pctOrcado: 10, aReceber: 10000, aPagar: 10000, atrasados: 0 });
    expect(por(r, "o-atraso")).toMatchObject({ orcado: 100000, comprometido: 30000, aReceber: 26000, aPagar: 30000, atrasados: 2 });
    // Confere com a tela "Orçado × comprado" de cada obra com orçamento de controle.
    ["o-ok", "o-atraso", "o-estouro"].forEach(id => {
      const tela = calcOrcadoComprado(data(), id);
      expect(por(r, id).comprometido).toBe(tela.linhas.reduce((s, l) => s + l.comprometido, 0) + tela.semApropriacao);
    });
  });

  it("rascunho e cancelado não entram no comprometido nem no a pagar", () => {
    const r = buildPurchasesByWork(data(), obras, HOJE);
    expect(por(r, "o-ok").comprometido).toBe(10000);
    expect(por(r, "o-ok").aPagar).toBe(10000);
  });

  it("obra sem orçamento mostra o comprometido pelos pedidos e explica a ausência", () => {
    const linha = por(buildPurchasesByWork(data(), obras, HOJE), "o-sem-orc");
    expect(linha).toMatchObject({ temControle: false, temOrcamento: false, motivoSemControle: "baseline_ausente", orcado: 0, comprometido: 3000, pctOrcado: null });
  });

  it("distingue 'tem orçamento, falta aprovar a baseline' de 'não tem orçamento'", () => {
    const linha = por(buildPurchasesByWork(data(), obras, HOJE), "o-sem-baseline");
    expect(linha).toMatchObject({ temControle: false, temOrcamento: true, motivoSemControle: "baseline_ausente", comprometido: 1000, aReceber: 0 });
  });

  it("baseline ambígua (duas ativas) aparece como tal", () => {
    const d = data();
    d.budgetBaselines.push({ obraId: "o-ok", tipo: "controle", ativo: true, budgetId: "b-ok" });
    expect(por(buildPurchasesByWork(d, obras, HOJE), "o-ok")).toMatchObject({ temControle: false, motivoSemControle: "baseline_ambigua" });
  });

  it("ordena por gravidade: estourou, depois atrasada, depois as demais", () => {
    const r = buildPurchasesByWork(data(), obras, HOJE);
    expect(por(r, "o-estouro")).toMatchObject({ estouradas: 1, pctOrcado: 150 });
    expect(r.linhas.slice(0, 2).map(l => l.obraId)).toEqual(["o-estouro", "o-atraso"]);
    expect(r.linhas.slice(2).every(l => l.gravidade === 3)).toBe(true);
  });

  it("totais somam as obras e não misturam obra sem orçamento no percentual", () => {
    const r = buildPurchasesByWork(data(), obras, HOJE);
    expect(r.totais).toMatchObject({ obras: 5, semControle: 2, orcado: 210000, comprometidoComControle: 55000, comprometido: 59000 });
    expect(r.totais.pctOrcado).toBeCloseTo(55000 / 210000 * 100, 5);
    expect(r.totais.atrasados).toBe(2);
  });

  it("com uma lista vazia de obras devolve estrutura vazia sem quebrar", () => {
    const r = buildPurchasesByWork(data(), [], HOJE);
    expect(r.linhas).toEqual([]);
    expect(r.totais).toMatchObject({ obras: 0, orcado: 0, pctOrcado: null });
  });
});

describe("calcOrcadoComprado · motivo da ausência do orçamento de controle", () => {
  it("informa o motivo e se existe orçamento", () => {
    expect(calcOrcadoComprado(data(), "o-sem-orc")).toMatchObject({ orc: null, motivo: "baseline_ausente", temOrcamento: false });
    expect(calcOrcadoComprado(data(), "o-sem-baseline")).toMatchObject({ orc: null, motivo: "baseline_ausente", temOrcamento: true });
    expect(calcOrcadoComprado(data(), "o-ok")).toMatchObject({ motivo: null, temOrcamento: true });
  });

  it("baseline que aponta para versão inexistente", () => {
    const d = data();
    d.budgetBaselines = [{ obraId: "o-sem-orc", tipo: "controle", ativo: true, budgetId: "nao-existe" }];
    expect(calcOrcadoComprado(d, "o-sem-orc")).toMatchObject({ orc: null, motivo: "versao_ausente" });
  });
});
