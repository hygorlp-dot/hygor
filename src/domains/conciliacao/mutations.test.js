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
  comercial: { contratos: [{ id: "ct1", numero: "CONT-1", contratante: "Cliente", entrada: 800, entradaPaga: false }] },
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

describe("A2. vincular quando o pagamento já foi registrado noutro módulo (Central de Pagamentos) sem transação", () => {
  test("liga a transação ao pagamento pré-existente da nota, sem criar novo pagamento", () => {
    const data = dataBase();
    data.notasFiscais[0].pagamentos = [{ id: "pgPre", valor: 500, conciliado: false, transacaoId: "" }];
    const { data: next, resumo } = vincularPagamentoExistente(data, {
      transacaoId: "t1", tipo: "pagamentoNota", entidadeId: "n1", pagamentoId: "pgPre", operador,
    });
    expect(resumo.ok).toBe(true);
    const nota = next.notasFiscais.find(n => n.id === "n1");
    expect(nota.pagamentos).toHaveLength(1); // nenhum pagamento novo criado
    expect(nota.pagamentos[0].conciliado).toBe(true);
    expect(nota.pagamentos[0].transacaoId).toBe("t1");
    expect(next.transacoes.find(t => t.id === "t1").status).toBe("conciliado");
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

  test("valida entrada de contrato de forma parcial e sem criar receita duplicada", () => {
    const data = dataBase();
    data.transacoes.push({ id: "t4", extratoId: "e1", data: "2026-01-13", valor: 300, status: "pendente", gerados: [] });
    const { data: parcial } = registrarPagamentoEConciliar(data, {
      transacaoId: "t3", tipo: "entradaContrato", entidadeId: "ct1", valor: 500, dataPagamento: "2026-01-12", operador,
    });
    const contratoParcial = parcial.comercial.contratos[0];
    expect(contratoParcial.entradaPaga).toBe(false);
    expect(contratoParcial.recebimentosEntrada).toHaveLength(1);
    expect(parcial.payments).toHaveLength(0);
    const { data: quitado } = registrarPagamentoEConciliar(parcial, {
      transacaoId: "t4", tipo: "entradaContrato", entidadeId: "ct1", valor: 300, dataPagamento: "2026-01-13", operador,
    });
    expect(quitado.comercial.contratos[0].entradaPaga).toBe(true);
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

  test("registra aporte no caixa sem classificá-lo como receita ou despesa", () => {
    const data = dataBase();
    const { data: next, resumo } = criarLancamentoPelaTransacao(data, {
      transacaoId: "t3", tipoLancamento: "entrada_caixa_obra", obraId: "o1", categoria: "aporte_cliente", operador, duplicidadeRevisada: true,
    });
    expect(resumo.ok).toBe(true);
    expect(next.caixaObra[0]).toMatchObject({ tipo: "aporte", efeitoDRE: "sem_efeito", conciliado: true, transacaoId: "t3" });
    expect(next.payments).toHaveLength(0);
    expect(next.outrasDesp).toHaveLength(0);
  });

  test("registra recebimento manual de obra por administração como receita vinculada ao extrato", () => {
    const data = dataBase();
    const { data: next, resumo } = criarLancamentoPelaTransacao(data, {
      transacaoId: "t3", tipoLancamento: "recebimento_administracao", obraId: "o-admin", descricao: "Taxa de administração", operador, duplicidadeRevisada: true,
    });
    expect(resumo.ok).toBe(true);
    expect(next.payments[0]).toMatchObject({
      obraId:"o-admin",amount:500,transacaoId:"t3",
      tipo:"recebimento_avulso",origem:"conciliacao_bancaria",conciliado:true,
    });
    expect(next.transacoes.find(t => t.id === "t3").status).toBe("conciliado");
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

  test("desfazer uma transferência reabre as duas pontas", () => {
    const data = dataBase();
    const { data: transferida } = marcarTransferenciaInterna(data, { transacaoOrigemId: "t1", transacaoDestinoId: "t3", operador });
    const { data: revertida } = desfazerConciliacao(transferida, "t1", operador, "correção");
    expect(revertida.transacoes.find(t => t.id === "t1").status).toBe("pendente");
    expect(revertida.transacoes.find(t => t.id === "t3").status).toBe("pendente");
  });

  test("bloqueia transferência com valores diferentes", () => {
    const data = dataBase();
    const { resumo } = marcarTransferenciaInterna(data, { transacaoOrigemId: "t2", transacaoDestinoId: "t3", operador });
    expect(resumo.ok).toBe(false);
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
    expect(revertido.notasFiscais.find(n => n.id === "n1").pagamentos).toHaveLength(1);
    expect(revertido.notasFiscais.find(n => n.id === "n1").pagamentos[0].status).toBe("estornado");
    expect(revertido.pedidos.find(p => p.id === "p1").pagamentos).toHaveLength(1);
    expect(revertido.pedidos.find(p => p.id === "p1").pagamentos[0].status).toBe("estornado");
    expect(revertido.notasFiscais.find(n => n.id === "n1")).toBeDefined(); // a nota em si nunca é apagada
  });
});

describe("período financeiro fechado - nenhuma conciliação altera fato dentro dele sem reabertura formal", () => {
  const dataComPeriodoFechado = () => ({
    ...dataBase(),
    fechamentosFinanceiros: [{ status: "fechado", dataInicio: "2026-01-01", dataFim: "2026-01-31" }],
  });

  test("bloqueia vincular pagamento existente numa transação de período fechado", () => {
    const { resumo } = vincularPagamentoExistente(dataComPeriodoFechado(), { transacaoId: "t2", tipo: "nota", entidadeId: "n2", operador });
    expect(resumo.ok).toBe(false);
    expect(resumo.motivo).toMatch(/período financeiro/i);
  });

  test("bloqueia registrar pagamento e conciliar numa data fechada", () => {
    const { resumo } = registrarPagamentoEConciliar(dataComPeriodoFechado(), {
      transacaoId: "t1", tipo: "nota", entidadeId: "n1", valor: 500, dataPagamento: "2026-01-10", operador,
    });
    expect(resumo.ok).toBe(false);
  });

  test("bloqueia criar lançamento novo numa data fechada, mesmo com duplicidade revisada", () => {
    const { resumo } = criarLancamentoPelaTransacao(dataComPeriodoFechado(), {
      transacaoId: "t1", tipoLancamento: "despesa_administrativa", descricao: "Tarifa", operador, duplicidadeRevisada: true,
    });
    expect(resumo.ok).toBe(false);
  });

  test("bloqueia transferência interna quando uma das pontas cai no período fechado", () => {
    const data = dataComPeriodoFechado();
    data.transacoes.push({ id: "t4", extratoId: "e2", data: "2026-02-05", valor: 500, status: "pendente", gerados: [] });
    const { resumo } = marcarTransferenciaInterna(data, { transacaoOrigemId: "t1", transacaoDestinoId: "t4", operador });
    expect(resumo.ok).toBe(false);
  });

  test("bloqueia estorno numa data fechada", () => {
    const { resumo } = marcarEstorno(dataComPeriodoFechado(), { transacaoId: "t3", operador });
    expect(resumo.ok).toBe(false);
  });

  test("bloqueia conciliação N:N quando algum movimento cai no período fechado", () => {
    const { resumo } = conciliarMuitosParaMuitos(dataComPeriodoFechado(), {
      transacaoIds: ["t1", "t2"], itens: [], ajustes: [], operador,
    });
    expect(resumo.ok).toBe(false);
  });

  test("bloqueia desfazer uma conciliação cujo fato está datado num período já fechado", () => {
    const livre = dataBase();
    const { data: vinculado } = vincularPagamentoExistente(livre, { transacaoId: "t2", tipo: "nota", entidadeId: "n2", operador });
    const fechado = { ...vinculado, fechamentosFinanceiros: [{ status: "fechado", dataInicio: "2026-01-01", dataFim: "2026-01-31" }] };
    const { resumo } = desfazerConciliacao(fechado, "t2", operador, "tentativa");
    expect(resumo.ok).toBe(false);
  });

  test("não bloqueia quando a data cai fora do intervalo fechado", () => {
    const data = dataComPeriodoFechado();
    data.transacoes.push({ id: "t5", extratoId: "e3", data: "2026-02-10", valor: -200, status: "pendente", gerados: [] });
    data.notasFiscais.push({ id: "n3", numero: "102", valorLiquido: 200, pagamentos: [] });
    const { resumo } = registrarPagamentoEConciliar(data, {
      transacaoId: "t5", tipo: "nota", entidadeId: "n3", valor: 200, dataPagamento: "2026-02-10", operador,
    });
    expect(resumo.ok).toBe(true);
  });
});
