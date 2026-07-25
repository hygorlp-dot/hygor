import {
  vincularPagamentoExistente, registrarPagamentoEConciliar, criarLancamentoPelaTransacao,
  conciliarMuitosParaMuitos, desfazerConciliacao, marcarTransferenciaInterna, marcarEstorno,
} from "./mutations";
import { totalRecebidoMedicao } from "./calculations";

const operador = { id: "u1", name: "Financeiro" };

const dataBase = () => ({
  transacoes: [
    { id: "t1", extratoId: "e1", data: "2026-01-10", valor: -500, status: "pendente", gerados: [] },
    { id: "t2", extratoId: "e1", data: "2026-01-11", valor: -300, status: "pendente", gerados: [] },
    { id: "t3", extratoId: "e1", data: "2026-01-12", valor: 500, status: "pendente", gerados: [] },
  ],
  notasFiscais: [
    { id: "n1", numero: "100", pedidoId: "p1", valorLiquido: 500, pagamentos: [] },
    { id: "n2", numero: "101", valorLiquido: 500, pagamentos: [{ id: "pgExistente", valor: 500, conciliado: false }] },
  ],
  pedidos: [{ id: "p1", numero: "P1", totalPedido: 500, pagamentos: [] }],
  medicoes: [{ id: "m1", valorPrevisto: 1000, recebimentos: [] }],
  outrasDesp: [], despesasEmpresa: [], payments: [], caixaObra: [], historicoConc: [],
  pagsTerceiros: [], medicoesTerc: [], pagamentosFolha: [],
});

describe("A. vincular pagamento já existente - nunca cria lançamento novo", () => {
  test("marca a transação conciliada sem tocar outrasDesp/despesasEmpresa/payments", () => {
    const data = dataBase();
    const { data: next, resumo } = vincularPagamentoExistente(data, {
      transacaoId: "t2", tipo: "nota", entidadeId: "n2", operador,
    });
    expect(resumo.ok).toBe(true);
    expect(next.transacoes.find(t => t.id === "t2").status).toBe("conciliado");
    expect(next.outrasDesp).toEqual(data.outrasDesp);
    expect(next.despesasEmpresa).toEqual(data.despesasEmpresa);
    expect(next.payments).toEqual(data.payments);
    expect(next.notasFiscais).toBe(data.notasFiscais); // nem o registro de origem foi tocado
  });

  test("recusa vincular uma transação já conciliada (bloqueio de dupla conciliação)", () => {
    const data = dataBase();
    data.transacoes[0].status = "conciliado";
    const { resumo } = vincularPagamentoExistente(data, { transacaoId: "t1", tipo: "nota", entidadeId: "n1", operador });
    expect(resumo.ok).toBe(false);
  });
});

describe("B. registrar pagamento de obrigação existente e conciliar", () => {
  test("cria o pagamento na nota e sincroniza proporcionalmente no pedido vinculado, sem duplicar lançamento genérico", () => {
    const data = dataBase();
    const { data: next, resumo } = registrarPagamentoEConciliar(data, {
      transacaoId: "t1", tipo: "nota", entidadeId: "n1", valor: 500, dataPagamento: "2026-01-10", operador,
    });
    expect(resumo.ok).toBe(true);
    const nota = next.notasFiscais.find(n => n.id === "n1");
    const pedido = next.pedidos.find(p => p.id === "p1");
    expect(nota.pagamentos).toHaveLength(1);
    expect(pedido.pagamentos).toHaveLength(1);
    expect(pedido.pagamentos[0].id).toBe(nota.pagamentos[0].id); // mesmo id nas duas estruturas, não duplicado
    expect(next.transacoes.find(t => t.id === "t1").status).toBe("conciliado");
    expect(next.outrasDesp).toHaveLength(0);
    expect(next.despesasEmpresa).toHaveLength(0);
  });

  test("registrar recebimento de medição aplica valor PARCIAL (não força recebido=true)", () => {
    const data = dataBase();
    const { data: next } = registrarPagamentoEConciliar(data, {
      transacaoId: "t3", tipo: "medicao", entidadeId: "m1", valor: 500, dataPagamento: "2026-01-12", operador,
    });
    const medicao = next.medicoes.find(m => m.id === "m1");
    expect(totalRecebidoMedicao(medicao)).toBe(500);
    expect(medicao.recebido).toBe(false);
  });

  test("pagamento a funcionário via banco não gera outrasDesp/despesasEmpresa (DRE já deriva do ponto)", () => {
    const data = { ...dataBase(), employees: [{ id: "f1", name: "João", pixHolder: "" }] };
    const { data: next } = registrarPagamentoEConciliar(data, {
      transacaoId: "t2", tipo: "funcionario", entidadeId: "f1", valor: 300, dataPagamento: "2026-01-11", operador,
    });
    expect(next.outrasDesp).toHaveLength(0);
    expect(next.despesasEmpresa).toHaveLength(0);
    expect(next.pagamentosFolha).toHaveLength(1);
  });
});

describe("C. criar lançamento novo - exige verificação de duplicidade prévia", () => {
  test("bloqueia criação sem duplicidadeRevisada", () => {
    const data = dataBase();
    const { resumo } = criarLancamentoPelaTransacao(data, {
      transacaoId: "t1", tipoLancamento: "despesa_obra", obraId: "o1", categoria: "outros", operador,
    });
    expect(resumo.ok).toBe(false);
  });

  test("cria despesa de obra quando a duplicidade já foi revisada", () => {
    const data = dataBase();
    const { data: next } = criarLancamentoPelaTransacao(data, {
      transacaoId: "t1", tipoLancamento: "despesa_obra", obraId: "o1", categoria: "outros", operador, duplicidadeRevisada: true,
    });
    expect(next.outrasDesp).toHaveLength(1);
    expect(next.transacoes.find(t => t.id === "t1").status).toBe("conciliado");
  });
});

describe("transferência interna e estorno não tocam receita/despesa", () => {
  test("marcarTransferenciaInterna vincula as duas pontas sem gerar lançamento", () => {
    const data = dataBase();
    const { data: next } = marcarTransferenciaInterna(data, { transacaoOrigemId: "t1", transacaoDestinoId: "t3", operador });
    expect(next.transacoes.find(t => t.id === "t1").status).toBe("conciliado");
    expect(next.transacoes.find(t => t.id === "t3").status).toBe("conciliado");
    expect(next.outrasDesp).toHaveLength(0);
    expect(next.despesasEmpresa).toHaveLength(0);
  });

  test("marcarEstorno nunca apaga o movimento original", () => {
    const data = dataBase();
    const { data: next } = marcarEstorno(data, { transacaoId: "t3", transacaoOrigemId: "t1", operador });
    expect(next.transacoes.find(t => t.id === "t1")).toBeDefined();
    expect(next.transacoes.find(t => t.id === "t3").vinculo).toEqual({ tipo: "estorno", id: "t1" });
  });
});

describe("N:N e fechamento em centavos", () => {
  test("bloqueia quando o rateio não fecha além da tolerância", () => {
    const data = dataBase();
    const { resumo } = conciliarMuitosParaMuitos(data, {
      transacaoIds: ["t1", "t2"], // soma 800
      itens: [{ tipoOrigem: "nota", entidadeId: "n1", valorAplicadoCentavos: 50000 }], // só 500
      ajustes: [], operador,
    });
    expect(resumo.ok).toBe(false);
  });

  test("fecha quando movimentos = itens + ajustes (com desconto)", () => {
    const data = dataBase();
    const { data: next, resumo } = conciliarMuitosParaMuitos(data, {
      transacaoIds: ["t1", "t2"], // 500 + 300 = 800
      itens: [{ tipoOrigem: "nota", entidadeId: "n1", valorAplicadoCentavos: 80500 }],
      ajustes: [{ tipo: "desconto", valorCentavos: 500 }],
      operador,
    });
    expect(resumo.ok).toBe(true);
    expect(next.transacoes.find(t => t.id === "t1").status).toBe("conciliado");
    expect(next.transacoes.find(t => t.id === "t2").status).toBe("conciliado");
    expect(next.conciliacoes).toHaveLength(1);
  });
});

describe("desfazer - nunca apaga registro pré-existente, só reverte o que a conciliação criou", () => {
  test("desfazer um vínculo simples (modo A) volta a transação para pendente sem tocar a nota", () => {
    const data = dataBase();
    const { data: vinculado } = vincularPagamentoExistente(data, { transacaoId: "t2", tipo: "nota", entidadeId: "n2", operador });
    const { data: revertido, resumo } = desfazerConciliacao(vinculado, "t2", operador, "teste");
    expect(resumo.ok).toBe(true);
    expect(revertido.transacoes.find(t => t.id === "t2").status).toBe("pendente");
    expect(revertido.notasFiscais.find(n => n.id === "n2").pagamentos).toHaveLength(1); // pagamento pré-existente preservado
  });

  test("desfazer um pagamento criado pela conciliação (modo B) remove só o que foi criado, preserva a nota", () => {
    const data = dataBase();
    const { data: pago } = registrarPagamentoEConciliar(data, {
      transacaoId: "t1", tipo: "nota", entidadeId: "n1", valor: 500, dataPagamento: "2026-01-10", operador,
    });
    const { data: revertido } = desfazerConciliacao(pago, "t1", operador, "estorno de teste");
    expect(revertido.transacoes.find(t => t.id === "t1").status).toBe("pendente");
    expect(revertido.notasFiscais.find(n => n.id === "n1").pagamentos).toHaveLength(0);
    expect(revertido.pedidos.find(p => p.id === "p1").pagamentos).toHaveLength(0);
    expect(revertido.notasFiscais.find(n => n.id === "n1")).toBeDefined(); // a nota em si nunca é apagada
  });
});
