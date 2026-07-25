import { criarIndicesFinanceiros } from "./selectors";
import { gerarCandidatosConciliacao, faixaDoScore, FAIXA_CONFIANCA } from "./matching";

describe("motor de candidatos - nunca decide sozinho, só pontua", () => {
  const data = {
    notasFiscais: [
      { id: "n1", numero: "100", valorLiquido: 1500, fornecedorNome: "Construtora Silva", documentoFornecedor: "12345678000199", vencimento: "2026-01-15", pagamentos: [] },
    ],
    pedidos: [], medicoes: [], medicoesTerc: [], terceirizados: [], employees: [], caixaObra: [],
    transacoes: [],
  };

  test("valor + CNPJ + data batendo gera uma candidata forte, mas nunca decide automaticamente", () => {
    const indices = criarIndicesFinanceiros(data);
    const transacao = {
      id: "t1", valor: -1500, data: "2026-01-16",
      contraparteNome: "Construtora Silva Ltda", contraparteDocumento: "12.345.678/0001-99",
    };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    expect(candidatas.length).toBeGreaterThan(0);
    const top = candidatas[0];
    expect(top.tipo).toBe("nota");
    expect(top.entidadeId).toBe("n1");
    expect(top.score).toBeGreaterThanOrEqual(60);
    expect(top.podeRegistrarPagamento).toBe(true);
  });

  test("valor muito acima do saldo em aberto gera bloqueio (não deixa vincular)", () => {
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t2", valor: -9000, data: "2026-01-16", contraparteNome: "Construtora Silva" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const nota = candidatas.find(c => c.entidadeId === "n1");
    expect(nota.bloqueios.length).toBeGreaterThan(0);
    expect(nota.podeRegistrarPagamento).toBe(false);
  });

  test("CNPJ divergente gera alerta em vez de reduzir a candidata ao silêncio", () => {
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t3", valor: -1500, data: "2026-01-16", contraparteDocumento: "99999999000199" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const nota = candidatas.find(c => c.entidadeId === "n1");
    expect(nota.alertas.some(a => a.includes("CPF/CNPJ"))).toBe(true);
  });

  test("transação já consumida por outro vínculo não é sugerida de novo", () => {
    const dataComVinculo = {
      ...data,
      transacoes: [{ id: "t0", valor: -1500, status: "conciliado", vinculo: { tipo: "nota", id: "n1" } }],
    };
    const indices = criarIndicesFinanceiros(dataComVinculo);
    const transacao = { id: "t4", valor: -1500, data: "2026-01-16", contraparteNome: "Construtora Silva" };
    const candidatas = gerarCandidatosConciliacao(transacao, dataComVinculo, indices);
    expect(candidatas.find(c => c.entidadeId === "n1")).toBeUndefined();
  });
});

describe("motor de candidatos - pagamento já registrado (modo A - vincular)", () => {
  test("um pagamento de nota já criado mas sem transação vira candidata de vínculo, não de novo pagamento", () => {
    const data = {
      notasFiscais: [{
        id: "n1", numero: "100", valorLiquido: 500, fornecedorNome: "Fornecedor X",
        pagamentos: [{ id: "pg1", valor: 500, conciliado: false, transacaoId: "" }],
      }],
      pedidos: [], medicoes: [], medicoesTerc: [], terceirizados: [], employees: [], caixaObra: [],
      transacoes: [],
    };
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t1", valor: -500, data: "2026-01-10", contraparteNome: "Fornecedor X" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const candidata = candidatas.find(c => c.tipo === "pagamentoNota");
    expect(candidata).toBeDefined();
    expect(candidata.pagamentoId).toBe("pg1");
    expect(candidata.podeVincular).toBe(true);
    expect(candidata.podeRegistrarPagamento).toBe(false);
  });
});

describe("faixas de confiança", () => {
  test("score alto sem alerta é 'forte'; com alerta cai para confirmação manual", () => {
    expect(faixaDoScore(97, false)).toBe(FAIXA_CONFIANCA.FORTE);
    expect(faixaDoScore(97, true)).toBe(FAIXA_CONFIANCA.CONFIRMAR);
    expect(faixaDoScore(70, false)).toBe(FAIXA_CONFIANCA.LISTA);
    expect(faixaDoScore(40, false)).toBe(FAIXA_CONFIANCA.FRACA);
  });
});
