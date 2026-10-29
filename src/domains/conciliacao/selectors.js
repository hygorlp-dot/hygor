import { contraparteDoFato } from "./counterparty.js";
// Índices de busca do motor de conciliação. Sem React, DOM ou persistência.
//
// O objetivo é montar, UMA VEZ por render da fila (não por transação), mapas
// que o motor de matching consulta em O(1)/O(k) em vez de varrer todo
// notasFiscais/pedidos/terceirizados/employees/medicoes a cada transação
// (o que seria O(n×m) e pesado com listas grandes).
import { paraCentavos, semAcento, totalRecebidoMedicao } from "./calculations.js";
import { saldoTituloFolha } from "./payroll.js";
import { saldoPagamentoPedido } from "../compras/calculations.js";
import { active } from "../financeiro/ledger.js";
import { saldoPagamentoNota } from "../financeiro/payables.js";
import { canLinkPaymentToCompanyBank } from "./existing-payment-link.js";

const push = (mapa, chave, item) => {
  if (!chave) return;
  const lista = mapa.get(chave);
  if (lista) lista.push(item);
  else mapa.set(chave, [item]);
};

const soNumeros = s => String(s || "").replace(/\D/g, "");
const normalizarPix = s => String(s || "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, "");
// Arquivar organiza o cadastro, sem apagar sua obrigação ou seu pagamento.
const disponivel = item => active(item) && item?.active !== false;
export const tokensContraparte = value => [...new Set(semAcento(value).split(/[^a-z0-9]+/).filter(token => token.length >= 3))];

// Total já recebido da entrada de um contrato comercial. Fonte única usada
// tanto para indexar a conciliação quanto para exibir saldo na tela - evita
// duas contas divergirem se só uma delas for atualizada no futuro.
export const recebidoEntradaContrato = contrato =>
  Array.isArray(contrato?.recebimentosEntrada)
    ? contrato.recebimentosEntrada.reduce((s, item) => s + Number(item.valor || 0), 0)
    : (contrato?.entradaPaga ? Number(contrato?.entrada || 0) : 0);

// Constrói todos os índices de uma vez, a partir do blob `data` inteiro.
// Chame uma vez por render da fila (ex.: dentro de um useMemo com
// dependência em data.notasFiscais/pedidos/... ), nunca dentro de um map()
// por transação.
export const criarIndicesFinanceiros = (data) => {
  const porValorCentavos = new Map();
  const porDocumento = new Map();
  const porContraparte = new Map();
  const porPixChave = new Map();
  const porObra = new Map();
  const porTokenContraparte = new Map();
  const porIdentificadorBancario = new Map();
  const fornecedores = new Map((data.fornecedores || []).map(item => [String(item.id), item]));
  const employees = new Map((data.employees || []).map(item => [String(item.id), item]));
  const obras = new Map((data.obras || []).map(item => [String(item.id), item]));
  const clientes = new Map((data.clientes || []).map(item => [String(item.id), item]));
  const usados = transacoesConsumidas(data);
  const alocacoes = (data.reconciliationLinks || []).filter(item => item.kind === "existing_cash_allocation" && item.status === "active");
  const pagamentosIndexados = new Set();
  const pagamentosCompras = [...(data.notasFiscais || []), ...(data.pedidos || [])].flatMap(item => item.pagamentos || []);
  const espelhosVinculados = new Set(pagamentosCompras.filter(item => item.transacaoId || item.conciliado).map(item => String(item.id)));
  const pagamentoDisponivel = item => disponivel(item) && item.id && !item.conciliado && !item.transacaoId &&
    canLinkPaymentToCompanyBank(item,item.pedido || item.nota) &&
    !usados.has(`pagamento:${item.id}`) && !espelhosVinculados.has(String(item.id)) &&
    !alocacoes.some(link => String(link.sourceSubId || link.sourceId || "") === String(item.id) ||
      (link.sourceType === "pagamento_folha" && String(link.sourceSubId || "").startsWith(`${item.id}-rateio-`)));
  const identidadeFornecedor = item => {
    const fornecedor = fornecedores.get(String(item.fornecedorId)) || {};
    return { documento: item.documentoFornecedor || fornecedor.cnpj || fornecedor.cpfCnpj || fornecedor.documento || "",
      contraparte: item.fornecedorNome || fornecedor.nome || fornecedor.razaoSocial || "",
      pixKey: fornecedor.chavePix || fornecedor.pixKey || "" };
  };
  const identidadeCliente = item => {
    const obra = obras.get(String(item.obraId)) || {};
    const cliente = clientes.get(String(item.clienteId || obra.clienteId)) || {};
    return { documento: cliente.cpfCnpj || cliente.cnpj || cliente.cpf || cliente.documento || "",
      contraparte: cliente.nome || cliente.name || item.clienteNome || obra.cliente || "",
      pixKey: cliente.chavePix || cliente.pixKey || "" };
  };

  const indexar = (item, { tipo, valor, documento = "", contraparte = "", pixKey = "", obraId, categoria = "" }) => {
    if (!item?.id) return;
    const party = contraparteDoFato(data, tipo, item);
    documento = documento || party.documento;
    contraparte = contraparte || party.nome;
    pixKey = pixKey || party.pix;
    const entrada = { tipo, item, obraId, documento, contraparte, pixKey, categoria, valorCentavos: paraCentavos(valor) };
    push(porValorCentavos, paraCentavos(valor), entrada);
    if (documento) push(porDocumento, soNumeros(documento), entrada);
    if (contraparte) push(porContraparte, semAcento(contraparte), entrada);
    tokensContraparte(contraparte).forEach(token => push(porTokenContraparte, token, entrada));
    if (pixKey) push(porPixChave, normalizarPix(pixKey), entrada);
    if (obraId) push(porObra, obraId, entrada);
    [item.fitid, item.endToEndId, item.txid, item.identificadorBancario].filter(Boolean).forEach(id => push(porIdentificadorBancario, String(id), entrada));
  };
  const indexarPagamento = (item, campos) => {
    if (!pagamentoDisponivel(item) || pagamentosIndexados.has(String(item.id)) || !(Number(campos.valor) > 0)) return;
    pagamentosIndexados.add(String(item.id));
    indexar(item, campos);
  };

  // Registro de "quem é dona desta chave PIX" - usado para identificar,
  // ao chegar uma transação, se a chave já está cadastrada como uma conta da
  // própria EMPRESA (então é provável transferência interna, não receita/despesa
  // nova) ou como FUNCIONÁRIO/TERCEIRO/FORNECEDOR/PROPRIETÁRIO de equipamento
  // (então a transação tem uma contraparte já conhecida, mesmo sem nota/pedido).
  const porPixRegistrado = new Map();
  const registrarPix = (pixKey, registro) => {
    const chave = normalizarPix(pixKey);
    if (!chave) return;
    const anterior = porPixRegistrado.get(chave);
    // Uma chave ou documento duplicado nunca vira identificação conclusiva.
    // Guardamos todos os donos para o motor explicar o bloqueio ao operador.
    if (!anterior) porPixRegistrado.set(chave, { ...registro, duplicado: false });
    else {
      const donos = [...(anterior.donos || [anterior]), registro];
      porPixRegistrado.set(chave, { ...anterior, duplicado: true, donos });
    }
  };
  (data.contasBancarias || []).forEach(c => c.pixKey && registrarPix(c.pixKey, { tipo: "empresa", nome: c.nome, id: c.id }));
  (data.employees || []).filter(e => e.active !== false).forEach(e => e.pixKey && registrarPix(e.pixKey, { tipo: "funcionario", nome: e.name || e.nome, id: e.id }));
  (data.terceirizados || []).forEach(t => t.pixKey && registrarPix(t.pixKey, { tipo: "terceiro", nome: t.name, id: t.id }));
  (data.fornecedores || []).forEach(f => f.chavePix && registrarPix(f.chavePix, { tipo: "fornecedor", nome: f.nome, id: f.id }));
  (data.proprietariosEquip || []).forEach(p => p.chavePix && registrarPix(p.chavePix, { tipo: "proprietarioEquip", nome: p.nome, id: p.id }));

  (data.notasFiscais || []).forEach(n => {
    if (!disponivel(n)) return;
    const identidade = identidadeFornecedor(n);
    // Pagamento JÁ registrado (ex.: pela Central de Pagamentos) mas ainda sem
    // transação vinculada - candidata de VÍNCULO (modo A), não de novo pagamento.
    (n.pagamentos || []).forEach(pg => {
      indexarPagamento({ ...pg, nota: n }, {
        tipo: "pagamentoNota", valor: pg.valor, ...identidade, obraId: n.obraId, categoria: n.categoria || "material",
      });
    });
    const saldo = saldoPagamentoNota(n);
    if (paraCentavos(saldo) <= 0) return;
    indexar(n, {
      tipo: "nota", valor: saldo, ...identidade, obraId: n.obraId, categoria: n.categoria || "material",
    });
  });

  (data.pedidos || []).forEach(p => {
    if (!disponivel(p)) return;
    const identidade = identidadeFornecedor(p);
    (p.pagamentos || []).forEach(pg => {
      indexarPagamento({ ...pg, pedido: p }, { tipo: "pagamentoPedido", valor: pg.valor, ...identidade, obraId: p.obraId, categoria: "material" });
    });
    // `totalPedido` é uma função de compras/calculations.js (soma dos itens);
    // nenhum pedido guarda esse campo. Ler `p.totalPedido` deixava o saldo em
    // zero e o pedido invisível para o extrato.
    const saldo = saldoPagamentoPedido(p);
    if (paraCentavos(saldo) > 0) indexar(p, { tipo: "pedido", valor: saldo, ...identidade, obraId: p.obraId, categoria: "material" });
  });

  // Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): faltava
  // obraId aqui - único tipo indexado sem ele, apesar do cadastro de
  // terceirizados já exigir obra (TerceirosView.jsx). Sem isso, todo
  // pagamento direto a um terceiro (sem medição) caía como custo da empresa
  // em vez da obra certa no DRE, mesmo a candidata já sabendo a obra.
  (data.terceirizados || []).filter(disponivel).forEach(t => {
    indexar(t, { tipo: "terceiro", valor: 0, documento: t.documento, contraparte: t.nome || t.name, pixKey: t.pixKey, obraId: t.obraId, categoria: "terceirizado" });
  });
  (data.medicoesTerc || []).forEach(m => {
    if (!disponivel(m)) return;
    const terceiro = (data.terceirizados || []).find(item => item.id === m.tercId) || {};
    const pagos = (data.pagsTerceiros || []).filter(active).filter(item => item.medicaoTercId === m.id);
    const saldo = Number(m.total || m.valorBruto || m.valor || 0) - pagos.reduce((sum, item) => sum + Number(item.amount || item.valor || 0), 0);
    if (paraCentavos(saldo) <= 0 || (m.pagamentoId && !pagos.length)) return;
    indexar(m, { tipo: "medicaoTerc", valor: saldo, obraId: m.obraId, categoria: "terceirizado", documento: terceiro.documento,
      contraparte: terceiro.name || terceiro.nome, pixKey: terceiro.pixKey });
  });

  (data.medicoes || []).forEach(m => {
    if (!disponivel(m)) return;
    const identidade = identidadeCliente(m);
    (m.recebimentos || []).forEach(recebimento => indexarPagamento({ ...recebimento, medicao: m }, {
      tipo: "recebimentoMedicao", valor: recebimento.valor, obraId: m.obraId, categoria: "faturamento", ...identidade,
    }));
    const saldo = Number(m.valorPrevisto || 0) - totalRecebidoMedicao(m);
    if (paraCentavos(saldo) <= 0) return;
    indexar(m, { tipo: "medicao", valor: saldo, obraId: m.obraId, categoria: "faturamento", ...identidade });
  });

  // Antes de uma venda ser transferida para Engenharia, a entrada existe no
  // contrato comercial, mas ainda não há uma medição/obra para indexar. Ela
  // também precisa poder ser validada diretamente pelo extrato bancário.
  (data.comercial?.contratos || []).forEach(contrato => {
    if (!disponivel(contrato)) return;
    const previsto = Number(contrato.entrada || 0);
    const recebido = recebidoEntradaContrato(contrato);
    const saldo = previsto - recebido;
    if (saldo <= 0.01) return;
    indexar(contrato, {
      tipo: "entradaContrato", valor: saldo, documento: contrato.cpfCnpj || contrato.documento || "",
      contraparte: contrato.contratante, obraId: contrato.obraId, categoria: "faturamento",
    });
  });

  (data.employees || []).filter(disponivel).forEach(e => {
    indexar(e, { tipo: "funcionario", valor: 0, documento: e.cpf || e.documento, contraparte: e.name || e.nome, pixKey: e.pixKey, obraId: e.obra, categoria: "mao_obra" });
  });

  // Folha fechada é a candidata prioritária para um PIX de funcionário. O
  // funcionário solto continua indexado como sugestão provisória, mas nunca
  // liquida custo: somente um título existente pode ser efetivado.
  (data.titulosFolha || []).forEach(title => {
    if (!disponivel(title)) return;
    const employee = employees.get(String(title.employeeId)) || {};
    const identidade = { documento: employee.cpf || employee.documento || title.documentoFuncionario,
      contraparte: employee.name || employee.nome || title.funcionarioNome,
      pixKey: employee.pixKey || title.chavePix,
      obraId: title.rateiosPorObra?.length === 1 ? title.rateiosPorObra[0].obraId : "", categoria: "mao_obra" };
    (title.liquidacoes || []).forEach(liquidacao => indexarPagamento({ ...liquidacao, tituloFolha: title }, {
      tipo: "liquidacaoFolha", valor: liquidacao.valor, ...identidade,
    }));
    const saldo = saldoTituloFolha(title);
    if (paraCentavos(saldo) > 0) indexar(title, { tipo: "tituloFolha", valor: saldo, ...identidade });
  });

  (data.pagamentosFolha || []).forEach(payment => {
    const employee = employees.get(String(payment.employeeId || payment.funcionarioId));
    if (!employee || !disponivel(employee)) return;
    indexarPagamento({ ...payment, employee }, { tipo: "pagamentoFolha", valor: payment.valor, categoria: "mao_obra",
      documento: employee.cpf || employee.documento, contraparte: employee.name || employee.nome, pixKey: employee.pixKey, obraId: payment.obraId || employee.obra });
  });

  ["outrasDesp", "despesasEmpresa"].forEach(tipo => (data[tipo] || []).forEach(expense => {
    if (!(expense.pago === true || expense.dataPagamento || expense.pagamentoId)) return;
    indexarPagamento(expense, { tipo, valor: expense.valor, categoria: expense.categoria || "outros", obraId: tipo === "outrasDesp" ? expense.obraId : "",
      contraparte: expense.fornecedor || expense.fornecedorNome || "", documento: expense.documentoFornecedor || "" });
  }));
  (data.payments || []).forEach(receipt => indexarPagamento(receipt, { tipo: "payments", valor: receipt.amount || receipt.valor,
    obraId: receipt.obraId, categoria: receipt.categoria || "recebimento_avulso", ...identidadeCliente(receipt) }));

  (data.caixaObra || []).forEach(c => {
    if (!pagamentoDisponivel(c)) return;
    // `tipo` fica no metadado do índice para o motor só oferecer "aporte"
    // (dinheiro entrando) como candidata de ENTRADA e "despesa" como SAÍDA -
    // sem isso um crédito bancário podia sugerir um lançamento de despesa.
    indexar({ ...c, _direcao: ["aporte", "receita", "entrada"].includes(c.tipo) ? "entrada" : "saida" }, { tipo: "caixaObra", valor: c.valor, obraId: c.obraId, categoria: c.categoria || "outros" });
  });

  return { porValorCentavos, porDocumento, porContraparte, porPixChave, porObra, porPixRegistrado, porTokenContraparte, porIdentificadorBancario,
    valoresOrdenados: [...porValorCentavos.keys()].filter(value => value > 0).sort((a, b) => a - b) };
};

// Dado um valor de "chave" bancária (PIX/documento/texto da descrição),
// procura se já está cadastrado na base como conta da empresa, funcionário,
// terceiro, fornecedor ou proprietário de equipamento. Não decide nada -
// só devolve QUEM é o dono conhecido daquela chave, para o motor usar como
// motivo/alerta (ex.: reforçar transferência interna, ou explicar uma
// contraparte que não tem nota/pedido em aberto).
export const buscarPixRegistrado = (indices, chave) => {
  const c = normalizarPix(chave);
  if (!c) return null;
  if (indices.porPixRegistrado.has(c)) return indices.porPixRegistrado.get(c);
  // Aceita a chave aparecendo dentro de um texto maior (descrição do banco).
  for (const [k, v] of indices.porPixRegistrado) {
    if (k.length >= 6 && c.includes(k)) return v;
  }
  return null;
};

// Transações já vinculadas a algum item de origem - usado para não sugerir
// duas vezes o mesmo pagamento/nota/pedido como candidato de outra transação.
export const transacoesConsumidas = (data) => {
  const set = new Set();
  (data.transacoes || []).forEach(t => {
    if (t.status !== "conciliado") return;
    const origem = { nota: ["notasFiscais", "pagamentos"], pagamentoNota: ["notasFiscais", "pagamentos"],
      pedido: ["pedidos", "pagamentos"], pagamentoPedido: ["pedidos", "pagamentos"],
      tituloFolha: ["titulosFolha", "liquidacoes"], medicao: ["medicoes", "recebimentos"] }[t.vinculo?.tipo];
    const registrados = origem ? ((data[origem[0]] || []).find(item => item.id === t.vinculo.id)?.[origem[1]] || [])
      : t.vinculo?.tipo === "funcionario" ? (data.pagamentosFolha || []).filter(item => (item.employeeId || item.funcionarioId) === t.vinculo.id)
        : t.vinculo?.tipo === "terceiro" ? (data.pagsTerceiros || []).filter(item => item.tercId === t.vinculo.id)
          : t.vinculo?.tipo === "medicaoTerc" ? (data.pagsTerceiros || []).filter(item => item.medicaoTercId === t.vinculo.id) : [];
    const pagamentos = [t.vinculo?.pagamentoId,
      ...(t.gerados || []).map(item => typeof item === "string" ? item : item?.id),
      ...registrados.filter(active).filter(item => item.transacaoId === t.id).map(item => item.id),
    ].filter(Boolean);
    pagamentos.forEach(id => set.add(`pagamento:${id}`));
    // Um vínculo comprovado por liquidação consome aquela liquidação, não
    // todo o título: o saldo restante pode ser pago em outro movimento.
    const comprovado = registrados.some(item => active(item) && (item.transacaoId === t.id || pagamentos.includes(item.id)));
    if (t.vinculo?.id && !comprovado) set.add(`${t.vinculo.tipo}:${t.vinculo.id}`);
  });
  return set;
};
