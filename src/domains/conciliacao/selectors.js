// Índices de busca do motor de conciliação. Sem React, DOM ou persistência.
//
// O objetivo é montar, UMA VEZ por render da fila (não por transação), mapas
// que o motor de matching consulta em O(1)/O(k) em vez de varrer todo
// notasFiscais/pedidos/terceirizados/employees/medicoes a cada transação
// (o que seria O(n×m) e pesado com listas grandes).
import { paraCentavos, semAcento } from "./calculations.js";
import { saldoTituloFolha, situacaoTituloFolha } from "./payroll.js";

const push = (mapa, chave, item) => {
  if (!chave) return;
  const lista = mapa.get(chave);
  if (lista) lista.push(item);
  else mapa.set(chave, [item]);
};

const soNumeros = s => String(s || "").replace(/\D/g, "");
const normalizarPix = s => String(s || "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, "");

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

  const indexar = (item, { tipo, valor, documento, contraparte, pixKey, obraId }) => {
    const entrada = { tipo, item, obraId };
    push(porValorCentavos, paraCentavos(valor), entrada);
    if (documento) push(porDocumento, soNumeros(documento), entrada);
    if (contraparte) push(porContraparte, semAcento(contraparte), entrada);
    if (pixKey) push(porPixChave, normalizarPix(pixKey), entrada);
    if (obraId) push(porObra, obraId, entrada);
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
    if (n.status === "cancelada") return;
    // Pagamento JÁ registrado (ex.: pela Central de Pagamentos) mas ainda sem
    // transação vinculada - candidata de VÍNCULO (modo A), não de novo pagamento.
    (n.pagamentos || []).forEach(pg => {
      if (pg.conciliado || pg.transacaoId) return;
      indexar({ id: pg.id, nota: n }, {
        tipo: "pagamentoNota", valor: pg.valor, documento: n.documentoFornecedor || n.numero,
        contraparte: n.fornecedorNome, obraId: n.obraId,
      });
    });
    const saldo = Number(n.valorLiquido || n.valorBruto || 0) -
      (n.pagamentos || []).reduce((s, p) => s + Number(p.valor || 0), 0);
    indexar(n, {
      tipo: "nota", valor: saldo, documento: n.documentoFornecedor || n.numero,
      contraparte: n.fornecedorNome, obraId: n.obraId,
    });
  });

  (data.pedidos || []).forEach(p => {
    if (p.status === "cancelado") return;
    (p.pagamentos || []).forEach(pg => {
      if (pg.conciliado || pg.transacaoId) return;
      indexar({ id: pg.id, pedido: p }, { tipo: "pagamentoPedido", valor: pg.valor, documento: p.numero, obraId: p.obraId });
    });
    const totalPago = (p.pagamentos || []).reduce((s, pg) => s + Number(pg.valor || 0), 0);
    const saldo = Number(p.totalPedido || 0) - totalPago;
    indexar(p, { tipo: "pedido", valor: saldo, documento: p.numero, obraId: p.obraId });
  });

  // Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): faltava
  // obraId aqui - único tipo indexado sem ele, apesar do cadastro de
  // terceirizados já exigir obra (TerceirosView.jsx). Sem isso, todo
  // pagamento direto a um terceiro (sem medição) caía como custo da empresa
  // em vez da obra certa no DRE, mesmo a candidata já sabendo a obra.
  (data.terceirizados || []).forEach(t => {
    indexar(t, { tipo: "terceiro", valor: 0, documento: t.documento, contraparte: t.nome, pixKey: t.pixKey, obraId: t.obraId });
  });
  (data.medicoesTerc || []).forEach(m => {
    if (m.pagamentoId) return; // já quitada
    indexar(m, { tipo: "medicaoTerc", valor: m.total, obraId: m.obraId });
  });

  (data.medicoes || []).forEach(m => {
    const total = Array.isArray(m.recebimentos) && m.recebimentos.length
      ? m.recebimentos.reduce((s, r) => s + Number(r.valor || 0), 0)
      : Number(m.valorRecebido || 0);
    const saldo = Number(m.valorPrevisto || 0) - total;
    if (saldo <= 0.01) return;
    indexar(m, { tipo: "medicao", valor: saldo, obraId: m.obraId });
  });

  // Antes de uma venda ser transferida para Engenharia, a entrada existe no
  // contrato comercial, mas ainda não há uma medição/obra para indexar. Ela
  // também precisa poder ser validada diretamente pelo extrato bancário.
  (data.comercial?.contratos || []).forEach(contrato => {
    const previsto = Number(contrato.entrada || 0);
    const recebido = recebidoEntradaContrato(contrato);
    const saldo = previsto - recebido;
    if (saldo <= 0.01) return;
    indexar(contrato, {
      tipo: "entradaContrato", valor: saldo, documento: contrato.numero,
      contraparte: contrato.contratante, obraId: contrato.obraId,
    });
  });

  (data.employees || []).filter(e => e.active !== false).forEach(e => {
    indexar(e, { tipo: "funcionario", valor: 0, contraparte: e.name || e.nome, pixKey: e.pixKey, obraId: e.obra });
  });

  // Folha fechada é a candidata prioritária para um PIX de funcionário. O
  // funcionário solto continua indexado como sugestão provisória, mas nunca
  // liquida custo: somente um título existente pode ser efetivado.
  (data.titulosFolha || []).forEach(title => {
    if (situacaoTituloFolha(title) === "pago" || title.status === "cancelado") return;
    const employee = (data.employees || []).find(e => e.id === title.employeeId) || {};
    const saldo = saldoTituloFolha(title);
    if (saldo <= 0.01) return;
    indexar(title, {
      tipo: "tituloFolha", valor: saldo,
      documento: employee.cpf || employee.documento || title.documentoFuncionario,
      contraparte: employee.name || employee.nome || title.funcionarioNome,
      pixKey: employee.pixKey || title.chavePix,
      obraId: title.rateiosPorObra?.length === 1 ? title.rateiosPorObra[0].obraId : "",
    });
  });

  (data.caixaObra || []).forEach(c => {
    if (c.conciliado) return;
    // `tipo` fica no metadado do índice para o motor só oferecer "aporte"
    // (dinheiro entrando) como candidata de ENTRADA e "despesa" como SAÍDA -
    // sem isso um crédito bancário podia sugerir um lançamento de despesa.
    indexar({ ...c, _direcao: c.tipo === "aporte" ? "entrada" : "saida" }, { tipo: "caixaObra", valor: c.valor, obraId: c.obraId });
  });

  return { porValorCentavos, porDocumento, porContraparte, porPixChave, porObra, porPixRegistrado };
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
    if (t.status === "conciliado" && t.vinculo?.id) set.add(`${t.vinculo.tipo}:${t.vinculo.id}`);
  });
  return set;
};
