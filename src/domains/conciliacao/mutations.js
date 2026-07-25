// Mutações financeiras compartilhadas da conciliação. Sem React, DOM ou
// persistência. Funções puras: recebem `data` (o blob inteiro) e devolvem
// `{ data: proximoData, resumo }` - nunca mutam o objeto recebido.
//
// Estas são as MESMAS funções que tanto a tela de Conciliação quanto a
// Central de Pagamentos devem chamar para registrar um pagamento. Não deve
// existir um segundo caminho que marque `transacoes` como conciliado sem
// passar por aqui - é isso que garante que DRE, saldo e histórico nunca
// duplicam o mesmo fato financeiro (requisito crítico da entrega).
import { aplicarRecebimentoMedicao, removerRecebimentoMedicao } from "./calculations.js";
import { saldoTituloFolha, situacaoTituloFolha, validarLiquidacaoFolha } from "./payroll.js";

export const gerarIdConc = (prefixo = "c") =>
  `${prefixo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const nomeOperador = operador => operador?.name || operador?.nome || operador?.email || "sistema";

const registrarHistorico = (historico, entrada) => [
  ...(historico || []),
  {
    id: gerarIdConc("hist"),
    criadoEm: new Date().toISOString(),
    ...entrada,
  },
];

const marcarTransacao = (transacoes, transacaoId, patch) =>
  (transacoes || []).map(t => (t.id === transacaoId ? { ...t, ...patch, statusAtualizadoEm: new Date().toISOString() } : t));

const transacaoPorId = (data, transacaoId) => (data.transacoes || []).find(t => t.id === transacaoId);

//
// A. VINCULAR A PAGAMENTO/LANÇAMENTO JÁ EXISTENTE
//
// Só liga a transação ao registro que já existe. NUNCA cria outrasDesp,
// despesasEmpresa ou payments novos, e NUNCA duplica o resultado no DRE -
// o fato financeiro já existia antes da conciliação.
export const vincularPagamentoExistente = (data, { transacaoId, tipo, entidadeId, pagamentoId, operador, observacao = "" }) => {
  const tr = transacaoPorId(data, transacaoId);
  if (!tr) return { data, resumo: { ok: false, motivo: "Transação não encontrada" } };
  if (tr.status === "conciliado") return { data, resumo: { ok: false, motivo: "Transação já conciliada" } };

  const vinculo = { tipo, id: entidadeId };
  const transacoes = marcarTransacao(data.transacoes, transacaoId, { status: "conciliado", vinculo, obs: observacao });

  let caixaObra = data.caixaObra, notasFiscais = data.notasFiscais, pedidos = data.pedidos, pagsTerceiros = data.pagsTerceiros;
  if (tipo === "caixaObra") {
    caixaObra = (data.caixaObra || []).map(c => (c.id === entidadeId ? { ...c, conciliado: true, transacaoId } : c));
  } else if (tipo === "pagamentoNota" && pagamentoId) {
    // O pagamento já existia (ex.: criado pela Central de Pagamentos sem
    // transação vinculada ainda) - só marca ele como conciliado, não cria nada.
    notasFiscais = (data.notasFiscais || []).map(n => n.id === entidadeId
      ? { ...n, pagamentos: (n.pagamentos || []).map(pg => pg.id === pagamentoId ? { ...pg, conciliado: true, transacaoId } : pg) }
      : n);
  } else if (tipo === "pagamentoPedido" && pagamentoId) {
    pedidos = (data.pedidos || []).map(p => p.id === entidadeId
      ? { ...p, pagamentos: (p.pagamentos || []).map(pg => pg.id === pagamentoId ? { ...pg, conciliado: true, transacaoId } : pg) }
      : p);
  } else if (tipo === "pagsTerceiros" && pagamentoId) {
    pagsTerceiros = (data.pagsTerceiros || []).map(pg => pg.id === pagamentoId ? { ...pg, conciliado: true, transacaoId } : pg);
  }

  const historicoConc = registrarHistorico(data.historicoConc, {
    transacaoId, extratoId: tr.extratoId, acao: "vinculo_confirmado",
    statusAnterior: tr.status, statusNovo: "conciliado",
    descricao: `Vínculo confirmado com ${tipo} ${entidadeId}`,
    valor: tr.valor, operadorId: operador?.id, operador: nomeOperador(operador),
  });

  return {
    data: { ...data, transacoes, caixaObra, notasFiscais, pedidos, pagsTerceiros, historicoConc },
    resumo: { ok: true, criados: [], vinculo },
  };
};

//
// B. REGISTRAR PAGAMENTO DE OBRIGAÇÃO EXISTENTE E CONCILIAR
//
// A nota/pedido/medição/contrato tem saldo mas ainda não tem pagamento
// registrado. Cria o pagamento DENTRO do registro de origem (respeitando as
// regras de cada módulo), liga a transação e marca parcial/quitada
// conforme o saldo. Nunca cria um lançamento genérico paralelo.
export const registrarPagamentoEConciliar = (data, params) => {
  const { transacaoId, tipo, entidadeId, valor, dataPagamento, operador, observacao = "" } = params;
  const tr = transacaoPorId(data, transacaoId);
  if (!tr) return { data, resumo: { ok: false, motivo: "Transação não encontrada" } };
  if (tr.status === "conciliado") return { data, resumo: { ok: false, motivo: "Transação já conciliada" } };

  const registradoPor = nomeOperador(operador);
  const criados = [];
  let next = { ...data };

  const basePagamento = () => ({
    id: gerarIdConc("pg"),
    data: dataPagamento || tr.data,
    valor: Math.abs(Number(valor ?? tr.valor)),
    origem: "banco",
    conciliado: true,
    transacaoId,
    referencia: observacao,
    observacao,
    comprovantes: [],
    registradoPorId: operador?.id, registradoPor,
    registradoEm: new Date().toISOString(),
  });

  if (tipo === "nota") {
    const pagamento = basePagamento();
    const notasFiscais = (next.notasFiscais || []).map(n => n.id === entidadeId
      ? { ...n, pagamentos: [...(n.pagamentos || []), pagamento], transacaoId }
      : n);
    const notaOriginal = (data.notasFiscais || []).find(n => n.id === entidadeId);
    let pedidos = next.pedidos;
    // Uma nota vinculada a pedido pode aparecer nas duas estruturas com o
    // mesmo id de pagamento - sincroniza para não duplicar entre elas.
    if (notaOriginal?.pedidoId) {
      pedidos = (next.pedidos || []).map(p => p.id === notaOriginal.pedidoId
        ? { ...p, pagamentos: [...(p.pagamentos || []), { ...pagamento, referencia: `Nota ${notaOriginal.numero || ""}` }] }
        : p);
    }
    next = { ...next, notasFiscais, pedidos };
    criados.push({ tipo: "pagamentoNota", id: pagamento.id, entidadeId });
  } else if (tipo === "pedido") {
    const pagamento = basePagamento();
    const pedidos = (next.pedidos || []).map(p => p.id === entidadeId
      ? { ...p, pagamentos: [...(p.pagamentos || []), pagamento] }
      : p);
    next = { ...next, pedidos };
    criados.push({ tipo: "pagamentoPedido", id: pagamento.id, entidadeId });
  } else if (tipo === "medicao") {
    const recebimentoId = gerarIdConc("rec");
    const medicoes = (next.medicoes || []).map(m => m.id === entidadeId
      ? aplicarRecebimentoMedicao(m, { id: recebimentoId, valor: Math.abs(Number(valor ?? tr.valor)), data: dataPagamento || tr.data, origem: "banco", transacaoId })
      : m);
    next = { ...next, medicoes };
    criados.push({ tipo: "recebimentoMedicao", id: recebimentoId, entidadeId });
  } else if (tipo === "entradaContrato") {
    if (Number(tr.valor) <= 0) return { data, resumo: { ok: false, motivo: "Entrada de contrato só pode ser conciliada com crédito bancário" } };
    const contrato = (data.comercial?.contratos || []).find(item => item.id === entidadeId);
    if (!contrato) return { data, resumo: { ok: false, motivo: "Contrato não encontrado" } };
    const previsto = Number(contrato.entrada || 0);
    if (!(previsto > 0)) return { data, resumo: { ok: false, motivo: "O contrato não possui valor de entrada configurado" } };
    const recebimentosAtuais = Array.isArray(contrato.recebimentosEntrada) ? contrato.recebimentosEntrada : [];
    const totalRecebido = recebimentosAtuais.reduce((s, item) => s + Number(item.valor || 0), 0);
    const valorRecebido = Math.abs(Number(valor ?? tr.valor));
    if (valorRecebido > previsto - totalRecebido + 0.01) return { data, resumo: { ok: false, motivo: "O valor é maior que o saldo da entrada do contrato" } };
    const recebimento = {
      id: gerarIdConc("reccontrato"), valor: valorRecebido, data: dataPagamento || tr.data,
      origem: "banco", transacaoId, conciliado: true, observacao,
      registradoPorId: operador?.id || "", registradoPor, registradoEm: new Date().toISOString(),
    };
    const recebidoApos = totalRecebido + valorRecebido;
    const contratos = (next.comercial?.contratos || []).map(item => item.id === entidadeId ? {
      ...item, recebimentosEntrada: [...recebimentosAtuais, recebimento],
      entradaPaga: recebidoApos >= previsto - 0.01,
      entradaPagaEm: recebidoApos >= previsto - 0.01 ? (dataPagamento || tr.data) : item.entradaPagaEm || "",
    } : item);
    next = { ...next, comercial: { ...(next.comercial || {}), contratos } };
    criados.push({ tipo: "recebimentoEntradaContrato", id: recebimento.id, entidadeId });
  } else if (tipo === "medicaoTerc") {
    const pagamentoId = gerarIdConc("pgterc");
    const medicaoTerc = (data.medicoesTerc || []).find(m => m.id === entidadeId);
    const novoPagTerceiro = {
      id: pagamentoId,
      tercId: medicaoTerc?.tercId, obraId: medicaoTerc?.obraId, medicaoTercId: entidadeId,
      pagador: "obra", data: dataPagamento || tr.data,
      amount: Math.abs(Number(valor ?? tr.valor)), liquido: Math.abs(Number(valor ?? tr.valor)),
      issRetido: 0, inssRetido: 0,
      conciliado: true, transacaoId,
      registradoPorId: operador?.id, registradoPor, registradoEm: new Date().toISOString(),
    };
    const medicoesTerc = (next.medicoesTerc || []).map(m => m.id === entidadeId ? { ...m, pagamentoId } : m);
    next = { ...next, medicoesTerc, pagsTerceiros: [...(next.pagsTerceiros || []), novoPagTerceiro] };
    criados.push({ tipo: "pagsTerceiros", id: pagamentoId, entidadeId });
  } else if (tipo === "terceiro") {
    const pagamentoId = gerarIdConc("pgterc");
    const novoPagTerceiro = {
      id: pagamentoId, tercId: entidadeId, obraId: tr.obraId || null,
      pagador: "obra", data: dataPagamento || tr.data,
      amount: Math.abs(Number(valor ?? tr.valor)), liquido: Math.abs(Number(valor ?? tr.valor)),
      issRetido: 0, inssRetido: 0,
      conciliado: true, transacaoId,
      registradoPorId: operador?.id, registradoPor, registradoEm: new Date().toISOString(),
    };
    next = { ...next, pagsTerceiros: [...(next.pagsTerceiros || []), novoPagTerceiro] };
    criados.push({ tipo: "pagsTerceiros", id: pagamentoId, entidadeId });
  } else if (tipo === "funcionario") {
    // Não recria custo de mão de obra (o DRE já deriva de ponto/folha).
    // Guarda só um registro de rastreabilidade do pagamento via banco,
    // inclusive quando o titular do PIX é diferente do funcionário.
    const pagamentoId = gerarIdConc("pgfolha");
    const emp = (data.employees || []).find(e => e.id === entidadeId);
    const novoPagamentoFolha = {
      id: pagamentoId, employeeId: entidadeId, data: dataPagamento || tr.data,
      valor: Math.abs(Number(valor ?? tr.valor)), transacaoId,
      pixHolder: emp?.pixHolder || "", alertaTitularDivergente: !!(emp?.pixHolder && emp?.pixHolder !== (emp?.name || emp?.nome)),
      registradoPorId: operador?.id, registradoPor, registradoEm: new Date().toISOString(),
    };
    next = { ...next, pagamentosFolha: [...(next.pagamentosFolha || []), novoPagamentoFolha] };
    criados.push({ tipo: "pagamentoFolha", id: pagamentoId, entidadeId });
  } else if (tipo === "tituloFolha") {
    const title = (data.titulosFolha || []).find(item => item.id === entidadeId);
    if (!title) return { data, resumo: { ok: false, motivo: "Título de folha não encontrado" } };
    const valorLiquidado = Math.abs(Number(valor ?? tr.valor));
    const erro = validarLiquidacaoFolha(title, valorLiquidado);
    if (erro) return { data, resumo: { ok: false, motivo: erro } };
    const liquidacao = {
      id: gerarIdConc("liqfolha"), payrollTitleId: title.id, transacaoId,
      valor: valorLiquidado, data: dataPagamento || tr.data,
      operadorId: operador?.id || "", operador: registradoPor, criadoEm: new Date().toISOString(),
    };
    const titulosFolha = (next.titulosFolha || []).map(item => {
      if (item.id !== entidadeId) return item;
      const liquidacoes = [...(item.liquidacoes || []), liquidacao];
      const valorPago = liquidacoes.reduce((sum, current) => sum + Number(current.valor || 0), 0);
      const atualizado = { ...item, liquidacoes, valorPago, saldo: Math.max(0, Number(item.liquido || 0) - valorPago) };
      return { ...atualizado, status: situacaoTituloFolha(atualizado), fechadoEm: situacaoTituloFolha(atualizado) === "pago" ? new Date().toISOString() : item.fechadoEm || "" };
    });
    const reconciliacaoLink = {
      id: gerarIdConc("link"), transacaoId, entidadeTipo: "tituloFolha", entidadeId,
      valorVinculado: valorLiquidado, operacao: "liquidar_e_vincular",
      score: Number(params.score || 0), confianca: params.confianca || "",
      motivos: Array.isArray(params.motivos) ? params.motivos : [], status: "confirmado",
      confirmadoPorId: operador?.id || "", confirmadoPor: registradoPor, confirmadoEm: new Date().toISOString(),
    };
    next = { ...next, titulosFolha, reconciliationLinks: [...(next.reconciliationLinks || []), reconciliacaoLink] };
    criados.push({ tipo: "liquidacaoFolha", id: liquidacao.id, entidadeId, reconciliationLinkId: reconciliacaoLink.id });
  } else {
    return { data, resumo: { ok: false, motivo: `Tipo de origem não suportado: ${tipo}` } };
  }

  const vinculo = { tipo, id: entidadeId };
  const transacoes = marcarTransacao(next.transacoes, transacaoId, {
    status: "conciliado", vinculo, gerados: criados, obs: observacao,
    valorVinculado: Math.abs(Number(valor ?? tr.valor)), saldoNaoVinculado: 0,
  });
  const historicoConc = registrarHistorico(next.historicoConc, {
    transacaoId, extratoId: tr.extratoId, acao: "pagamento_registrado",
    statusAnterior: tr.status, statusNovo: "conciliado",
    descricao: `Pagamento registrado em ${tipo} ${entidadeId} e conciliado`,
    valor: tr.valor, detalhes: criados, operadorId: operador?.id, operador: registradoPor,
  });

  return { data: { ...next, transacoes, historicoConc }, resumo: { ok: true, criados, vinculo } };
};

//
// C. CRIAR LANÇAMENTO NOVO
//
// Só deve ser chamado depois que a tela já rodou gerarCandidatosConciliacao
// de novo e confirmou que não existe fato financeiro correspondente -
// `duplicidadeRevisada` documenta que essa checagem foi feita.
export const criarLancamentoPelaTransacao = (data, params) => {
  const { transacaoId, tipoLancamento, obraId, categoria, descricao, operador, duplicidadeRevisada = false } = params;
  const tr = transacaoPorId(data, transacaoId);
  if (!tr) return { data, resumo: { ok: false, motivo: "Transação não encontrada" } };
  if (tr.status === "conciliado") return { data, resumo: { ok: false, motivo: "Transação já conciliada" } };
  if (!duplicidadeRevisada) return { data, resumo: { ok: false, motivo: "Verificação de duplicidade obrigatória antes de criar lançamento novo" } };

  const valor = Math.abs(Number(tr.valor));
  const id = gerarIdConc("lanc");
  const registradoPor = nomeOperador(operador);
  let next = { ...data };
  const criados = [];

  if (tipoLancamento === "despesa_obra") {
    const item = { id, obraId, competencia: (tr.data || "").slice(0, 7), data:tr.data, dataPagamento:tr.data, pago:true, categoria: categoria || "outros", descricao: descricao || tr.descricao, valor, contaAdmin: false, transacaoId };
    next = { ...next, outrasDesp: [...(next.outrasDesp || []), item] };
    criados.push({ tipo: "outrasDesp", id, entidadeId: id });
  } else if (tipoLancamento === "despesa_administrativa" || tipoLancamento === "tarifa_bancaria" || tipoLancamento === "tributo") {
    const item = { id, competencia: (tr.data || "").slice(0, 7), data:tr.data, dataPagamento:tr.data, pago:true, categoria: categoria || tipoLancamento, descricao: descricao || tr.descricao, valor, recorrente: false, transacaoId };
    next = { ...next, despesasEmpresa: [...(next.despesasEmpresa || []), item] };
    criados.push({ tipo: "despesasEmpresa", id, entidadeId: id });
  } else if (tipoLancamento === "recebimento_administracao") {
    if (Number(tr.valor) <= 0) return { data, resumo: { ok: false, motivo: "Recebimento de obra exige uma entrada bancária" } };
    if (!obraId) return { data, resumo: { ok: false, motivo: "Selecione a obra por administração" } };
    // Receita efetivamente recebida em uma obra administrada que não possui
    // parcela/medição pré-cadastrada. É o caminho manual explícito para não
    // forçar o operador a selecionar uma medição de outra obra.
    const item = {
      id, obraId, date: tr.data, amount: valor, description: descricao || tr.descricao,
      tipo: "recebimento_avulso", origem: "conciliacao_bancaria", transacaoId, conciliado: true,
      registradoPorId: operador?.id || "", registradoPor, registradoEm: new Date().toISOString(),
    };
    next = { ...next, payments: [...(next.payments || []), item] };
    criados.push({ tipo: "payments", id, entidadeId: id });
  } else if (["recebimento_avulso", "adiantamento", "entrada_caixa_obra", "aporte_socio", "emprestimo", "outra_entrada"].includes(tipoLancamento)) {
    if (Number(tr.valor) <= 0) return { data, resumo: { ok: false, motivo: "Este lançamento exige uma entrada bancária" } };
    if (tipoLancamento === "entrada_caixa_obra" && !obraId) return { data, resumo: { ok: false, motivo: "Selecione a obra para registrar a entrada no caixa" } };
    // Aporte, empréstimo e recursos mantidos no caixa são movimentos de caixa,
    // não receita. O efeito econômico fica explícito para o DRE não somar uma
    // segunda vez uma entrada que será reconhecida pelo contrato/medição.
    const item = {
      id, obraId, data: tr.data, tipo: "aporte", categoria: categoria || tipoLancamento,
      naturezaEntrada: tipoLancamento, efeitoDRE: "sem_efeito", descricao: descricao || tr.descricao,
      valor, transacaoId, registradoPorId: operador?.id || "", registradoPor, registradoEm: new Date().toISOString(),
    };
    next = { ...next, caixaObra: [...(next.caixaObra || []), { ...item, conciliado: true }] };
    criados.push({ tipo: "caixaObra", id, entidadeId: id });
  } else {
    return { data, resumo: { ok: false, motivo: `Tipo de lançamento não suportado: ${tipoLancamento}` } };
  }

  const vinculo = { tipo: "lancamento_novo", id };
  const transacoes = marcarTransacao(next.transacoes, transacaoId, { status: "conciliado", vinculo, gerados: criados });
  const historicoConc = registrarHistorico(next.historicoConc, {
    transacaoId, extratoId: tr.extratoId, acao: "lancamento_criado",
    statusAnterior: tr.status, statusNovo: "conciliado",
    descricao: `Novo lançamento (${tipoLancamento}) criado a partir da transação`,
    valor: tr.valor, detalhes: criados, operadorId: operador?.id, operador: registradoPor,
  });

  return { data: { ...next, transacoes, historicoConc }, resumo: { ok: true, criados, vinculo } };
};

//
// TRANSFERÊNCIA INTERNA
//
// Liga duas transações (débito numa conta, crédito noutra) como o mesmo
// movimento de caixa. Não gera receita nem despesa, não toca o DRE.
export const marcarTransferenciaInterna = (data, { transacaoOrigemId, transacaoDestinoId, operador }) => {
  const origem = transacaoPorId(data, transacaoOrigemId);
  const destino = transacaoPorId(data, transacaoDestinoId);
  if (!origem || !destino) return { data, resumo: { ok: false, motivo: "Transação não encontrada" } };
  if (origem.id === destino.id) return { data, resumo: { ok: false, motivo: "A transferência exige duas transações distintas" } };
  if (origem.status === "conciliado" || destino.status === "conciliado") return { data, resumo: { ok: false, motivo: "Uma das transações já está conciliada" } };
  if (Math.sign(Number(origem.valor)) === Math.sign(Number(destino.valor))) return { data, resumo: { ok: false, motivo: "Transferência interna exige uma saída e uma entrada" } };
  if (Math.abs(Math.abs(Number(origem.valor)) - Math.abs(Number(destino.valor))) > 0.01) return { data, resumo: { ok: false, motivo: "Os valores da transferência não conferem" } };

  const parId = gerarIdConc("transf");
  const vinculo = { tipo: "transferencia_interna", id: parId };
  const geradoOrigem = { tipo: "transferenciaInterna", id: parId, outraTransacaoId: transacaoDestinoId };
  const geradoDestino = { tipo: "transferenciaInterna", id: parId, outraTransacaoId: transacaoOrigemId };
  let transacoes = marcarTransacao(data.transacoes, transacaoOrigemId, { status: "conciliado", vinculo, gerados: [geradoOrigem] });
  transacoes = marcarTransacao(transacoes, transacaoDestinoId, { status: "conciliado", vinculo, gerados: [geradoDestino] });

  const registradoPor = nomeOperador(operador);
  let historicoConc = registrarHistorico(data.historicoConc, {
    transacaoId: transacaoOrigemId, extratoId: origem.extratoId, acao: "transferencia_interna",
    statusAnterior: origem.status, statusNovo: "conciliado",
    descricao: `Transferência interna vinculada à transação ${transacaoDestinoId}`,
    valor: origem.valor, operadorId: operador?.id, operador: registradoPor,
  });
  historicoConc = registrarHistorico(historicoConc, {
    transacaoId: transacaoDestinoId, extratoId: destino.extratoId, acao: "transferencia_interna",
    statusAnterior: destino.status, statusNovo: "conciliado",
    descricao: `Transferência interna vinculada à transação ${transacaoOrigemId}`,
    valor: destino.valor, operadorId: operador?.id, operador: registradoPor,
  });

  return { data: { ...data, transacoes, historicoConc }, resumo: { ok: true, criados: [], vinculo } };
};

//
// ESTORNO
//
// Liga o estorno ao movimento original. Nunca apaga o movimento original.
export const marcarEstorno = (data, { transacaoId, transacaoOrigemId, operador }) => {
  const tr = transacaoPorId(data, transacaoId);
  if (!tr) return { data, resumo: { ok: false, motivo: "Transação não encontrada" } };
  if (tr.status === "conciliado") return { data, resumo: { ok: false, motivo: "Transação já está conciliada" } };
  const origem = transacaoOrigemId ? transacaoPorId(data, transacaoOrigemId) : null;
  if (transacaoOrigemId && !origem) return { data, resumo: { ok: false, motivo: "Movimento original não encontrado" } };
  if (origem && Math.sign(Number(origem.valor)) === Math.sign(Number(tr.valor))) return { data, resumo: { ok: false, motivo: "Estorno deve ter sinal oposto ao movimento original" } };

  const vinculo = { tipo: "estorno", id: transacaoOrigemId };
  const transacoes = marcarTransacao(data.transacoes, transacaoId, { status: "conciliado", vinculo });
  const historicoConc = registrarHistorico(data.historicoConc, {
    transacaoId, extratoId: tr.extratoId, acao: "estorno_vinculado",
    statusAnterior: tr.status, statusNovo: "conciliado",
    descricao: transacaoOrigemId ? `Estorno vinculado ao movimento original ${transacaoOrigemId}` : "Marcado como estorno sem origem localizada",
    valor: tr.valor, operadorId: operador?.id, operador: nomeOperador(operador),
  });

  return { data: { ...data, transacoes, historicoConc }, resumo: { ok: true, criados: [], vinculo } };
};

//
// N:N - vários movimentos quitando vários lançamentos, com ajustes (juros,
// multa, desconto, tarifa...). O fechamento em centavos é responsabilidade
// de quem monta `itens`/`ajustes` (a tela); aqui só validamos que fecha.
export const conciliarMuitosParaMuitos = (data, params) => {
  const { transacaoIds = [], itens = [], ajustes = [], operador, toleranciaCentavos = 1 } = params;
  const transacoesAlvo = transacaoIds.map(id => transacaoPorId(data, id)).filter(Boolean);
  if (transacoesAlvo.length !== transacaoIds.length) return { data, resumo: { ok: false, motivo: "Alguma transação não foi encontrada" } };
  if (transacoesAlvo.some(t => t.status === "conciliado")) return { data, resumo: { ok: false, motivo: "Alguma transação já está conciliada" } };

  const valorMovimentos = transacoesAlvo.reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  const valorItens = itens.reduce((s, i) => s + Number(i.valorAplicadoCentavos || 0), 0) / 100;
  const valorAjustes = ajustes.reduce((s, a) => s + (a.tipo === "desconto" ? -Number(a.valorCentavos || 0) : Number(a.valorCentavos || 0)), 0) / 100;
  const diferenca = Math.round((valorMovimentos - (valorItens + valorAjustes)) * 100);
  if (Math.abs(diferenca) > toleranciaCentavos) {
    return { data, resumo: { ok: false, motivo: `Rateio não fecha: diferença de ${diferenca} centavos` } };
  }

  const conciliacaoId = gerarIdConc("conc");
  const registradoPor = nomeOperador(operador);
  const conciliacao = {
    id: conciliacaoId,
    movimentos: transacoesAlvo.map(t => ({ transacaoId: t.id, valorAplicadoCentavos: Math.round(Math.abs(Number(t.valor)) * 100) })),
    itens, ajustes,
    valorMovimentosCentavos: Math.round(valorMovimentos * 100),
    valorItensCentavos: Math.round(valorItens * 100),
    diferencaCentavos: diferenca,
    status: "confirmada", modo: "muitos_para_muitos", automatica: false,
    confirmadoPorId: operador?.id, confirmadoPor: registradoPor, confirmadoEm: new Date().toISOString(),
  };

  let transacoes = data.transacoes;
  transacaoIds.forEach(id => {
    transacoes = marcarTransacao(transacoes, id, { status: "conciliado", vinculo: { tipo: "conciliacao_multipla", id: conciliacaoId } });
  });

  const historicoConc = registrarHistorico(data.historicoConc, {
    transacaoId: transacaoIds[0], acao: "conciliacao_multipla",
    statusNovo: "conciliado", descricao: `Conciliação N:N (${transacaoIds.length} movimentos, ${itens.length} itens)`,
    detalhes: { conciliacaoId }, operadorId: operador?.id, operador: registradoPor,
  });

  return {
    data: { ...data, transacoes, historicoConc, conciliacoes: [...(data.conciliacoes || []), conciliacao] },
    resumo: { ok: true, criados: [{ tipo: "conciliacao", id: conciliacaoId }], conciliacaoId },
  };
};

//
// DESFAZER
//
// Nunca apaga nota/pedido/contrato/medição/pagamento pré-existente - só
// remove o vínculo e reverte os campos que a própria conciliação alterou.
// Só apaga registros marcados como CRIADOS durante aquela conciliação.
export const desfazerConciliacao = (data, transacaoId, operador, motivo = "") => {
  const tr = transacaoPorId(data, transacaoId);
  if (!tr) return { data, resumo: { ok: false, motivo: "Transação não encontrada" } };
  if (tr.status !== "conciliado") return { data, resumo: { ok: false, motivo: "Transação não está conciliada" } };

  const gerados = tr.gerados || [];
  let next = { ...data };
  const estornar = item => ({
    ...item,status:"estornado",motivoEstorno:motivo||"Conciliação bancária desfeita",
    estornadoEm:new Date().toISOString(),estornadoPorId:operador?.id||"",estornadoPor:nomeOperador(operador),
  });

  gerados.forEach(g => {
    if (g.tipo === "pagamentoNota") {
      next = { ...next, notasFiscais: (next.notasFiscais || []).map(n => n.id === g.entidadeId
        ? { ...n, pagamentos: (n.pagamentos || []).map(p => p.id === g.id ? estornar(p) : p) } : n) };
      next = { ...next, pedidos: (next.pedidos || []).map(p => ({ ...p, pagamentos: (p.pagamentos || []).map(pg => pg.id === g.id ? estornar(pg) : pg) })) };
    } else if (g.tipo === "pagamentoPedido") {
      next = { ...next, pedidos: (next.pedidos || []).map(p => p.id === g.entidadeId
        ? { ...p, pagamentos: (p.pagamentos || []).map(pg => pg.id === g.id ? estornar(pg) : pg) } : p) };
    } else if (g.tipo === "recebimentoMedicao") {
      next = { ...next, medicoes: (next.medicoes || []).map(m => m.id === g.entidadeId
        ? removerRecebimentoMedicao(m, g.id) : m) };
    } else if (g.tipo === "recebimentoEntradaContrato") {
      next = {
        ...next,
        comercial: {
          ...(next.comercial || {}),
          contratos: (next.comercial?.contratos || []).map(contrato => {
            if (contrato.id !== g.entidadeId) return contrato;
            const recebimentosEntrada = (contrato.recebimentosEntrada || []).map(item => item.id === g.id ? estornar(item) : item);
            const total = recebimentosEntrada.filter(item=>item.status!=="estornado").reduce((s, item) => s + Number(item.valor || 0), 0);
            return { ...contrato, recebimentosEntrada, entradaPaga: total >= Number(contrato.entrada || 0) - 0.01, entradaPagaEm: "" };
          }),
        },
      };
    } else if (g.tipo === "pagsTerceiros") {
      const pg = (next.pagsTerceiros || []).find(p => p.id === g.id);
      next = { ...next, pagsTerceiros: (next.pagsTerceiros || []).map(p => p.id === g.id ? estornar(p) : p) };
      if (pg?.medicaoTercId) {
        next = { ...next, medicoesTerc: (next.medicoesTerc || []).map(m => m.id === pg.medicaoTercId ? { ...m, pagamentoId: null } : m) };
      }
    } else if (g.tipo === "pagamentoFolha") {
      next = { ...next, pagamentosFolha: (next.pagamentosFolha || []).map(p => p.id === g.id ? estornar(p) : p) };
    } else if (g.tipo === "liquidacaoFolha") {
      next = {
        ...next,
        titulosFolha: (next.titulosFolha || []).map(title => {
          if (title.id !== g.entidadeId) return title;
          const liquidacoes = (title.liquidacoes || []).map(item => item.id === g.id ? estornar(item) : item);
          const valorPago = liquidacoes.filter(item=>item.status!=="estornado").reduce((sum, item) => sum + Number(item.valor || 0), 0);
          const atualizado = { ...title, liquidacoes, valorPago, saldo: Math.max(0, Number(title.liquido || 0) - valorPago) };
          return { ...atualizado, status: situacaoTituloFolha(atualizado), fechadoEm: "" };
        }),
        reconciliationLinks: (next.reconciliationLinks || []).map(link => link.id === g.reconciliationLinkId
          ? { ...link, status: "desfeito", desfeitoEm: new Date().toISOString(), desfeitoPorId: operador?.id || "" }
          : link),
      };
    } else if (["outrasDesp", "despesasEmpresa", "caixaObra", "payments"].includes(g.tipo)) {
      next = { ...next, [g.tipo]: (next[g.tipo] || []).map(item => item.id === g.id ? estornar(item) : item) };
    }
  });

  if (tr.vinculo?.tipo === "caixaObra") {
    next = { ...next, caixaObra: (next.caixaObra || []).map(c => c.id === tr.vinculo.id ? { ...c, conciliado: false, transacaoId: null } : c) };
  }
  if (tr.vinculo?.tipo === "transferencia_interna") {
    const parId = tr.vinculo.id;
    const outra = (next.transacoes || []).find(item => item.id !== transacaoId && item.vinculo?.tipo === "transferencia_interna" && item.vinculo.id === parId);
    if (outra) {
      next = {
        ...next,
        transacoes: marcarTransacao(next.transacoes, outra.id, { status: "pendente", vinculo: null, gerados: [] }),
        historicoConc: registrarHistorico(next.historicoConc, {
          transacaoId: outra.id, extratoId: outra.extratoId, acao: "transferencia_desfeita",
          statusAnterior: "conciliado", statusNovo: "pendente", descricao: motivo || "Transferência interna desfeita",
          valor: outra.valor, operadorId: operador?.id, operador: nomeOperador(operador),
        }),
      };
    }
  }
  if (tr.vinculo?.tipo === "conciliacao_multipla") {
    next = { ...next, conciliacoes: (next.conciliacoes || []).map(c => c.id === tr.vinculo.id
      ? { ...c, status: "desfeita", desfeitaPorId: operador?.id, desfeitaPor: nomeOperador(operador), desfeitaEm: new Date().toISOString(), motivoDesfazer: motivo }
      : c) };
  }

  const transacoes = marcarTransacao(next.transacoes, transacaoId, { status: "pendente", vinculo: null, gerados: [] });
  const historicoConc = registrarHistorico(next.historicoConc, {
    transacaoId, extratoId: tr.extratoId, acao: "desfeito",
    statusAnterior: "conciliado", statusNovo: "pendente",
    descricao: motivo || "Conciliação desfeita",
    valor: tr.valor, operadorId: operador?.id, operador: nomeOperador(operador),
  });

  return { data: { ...next, transacoes, historicoConc }, resumo: { ok: true, revertidos: gerados } };
};
