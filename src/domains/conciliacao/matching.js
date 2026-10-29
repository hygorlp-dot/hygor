import { contraparteDoFato } from "./counterparty.js";
// Motor de candidatos da conciliação. Sem React, DOM ou persistência.
//
// Dado um movimento bancário (transação) e os índices já montados
// (ver selectors.js), devolve uma lista de candidatas ordenadas por score -
// nunca uma decisão automática. A decisão de vincular, pagar ou criar
// sempre passa por confirmação do usuário (ou por regra explícita
// aprovada), conforme as faixas de confiança abaixo.
import { paraCentavos, semAcento, diasEntre, totalRecebidoMedicao } from "./calculations.js";
import { transacoesConsumidas, buscarPixRegistrado, tokensContraparte } from "./selectors.js";
import { resumoTituloFolha, saldoTituloFolha } from "./payroll.js";
import { saldoPagamentoPedido } from "../compras/calculations.js";
import { saldoPagamentoNota } from "../financeiro/payables.js";

const soNumeros = s => String(s || "").replace(/\D/g, "");

// Faixas de decisão (§6.5 do pedido original). O motor só CLASSIFICA a
// confiança; quem decide o que fazer com cada faixa é a tela.
export const FAIXA_CONFIANCA = Object.freeze({
  AUTOMATICA: "automatica",   // identificador único, sem alerta
  FORTE: "forte",              // 95-100
  CONFIRMAR: "confirmar",      // 80-94
  LISTA: "lista",               // 60-79
  FRACA: "fraca",               // < 60
});

export const faixaDoScore = (score, temAlerta) => {
  if (temAlerta) return score >= 80 ? FAIXA_CONFIANCA.CONFIRMAR : FAIXA_CONFIANCA.LISTA;
  if (score >= 95) return FAIXA_CONFIANCA.FORTE;
  if (score >= 80) return FAIXA_CONFIANCA.CONFIRMAR;
  if (score >= 60) return FAIXA_CONFIANCA.LISTA;
  return FAIXA_CONFIANCA.FRACA;
};

// Monta uma candidata no formato padronizado (§6.6). `origem` é o registro
// bruto vindo do índice (nota, pedido, medição, terceiro, funcionário...).
export const candidata = (base) => ({
  tipo: base.tipo,
  entidadeId: base.entidadeId || null,
  pagamentoId: base.pagamentoId || null,
  obraId: base.obraId || null,
  pessoaId: base.pessoaId || null,
  titulo: base.titulo || "",
  subtitulo: base.subtitulo || "",
  valorOriginalCentavos: base.valorOriginalCentavos || 0,
  saldoCentavos: base.saldoCentavos ?? base.valorOriginalCentavos ?? 0,
  dataPrevista: base.dataPrevista || "",
  documento: base.documento || "",
  contraparte: base.contraparte || "",
  categoria: base.categoria || "",
  score: 0,
  confianca: FAIXA_CONFIANCA.FRACA,
  motivos: [],
  alertas: [],
  bloqueios: [],
  podeVincular: !!base.podeVincular,
  podeRegistrarPagamento: !!base.podeRegistrarPagamento,
  metadados: base.metadados || {},
});

const pontuarValor = (transacaoCentavos, saldoCentavos) => {
  if (saldoCentavos <= 0) return { pts: 0, motivo: null };
  const diff = Math.abs(Math.abs(transacaoCentavos) - saldoCentavos);
  if (diff === 0) return { pts: 30, motivo: "Valor exato" };
  if (diff <= 100) return { pts: 22, motivo: "Valor muito próximo (diferença de centavos)" };
  const pct = diff / saldoCentavos;
  if (pct <= 0.02) return { pts: 15, motivo: "Valor próximo (até 2% de diferença)" };
  if (pct <= 0.1) return { pts: 6, motivo: null };
  return { pts: 0, motivo: null };
};

const pontuarDocumento = (docTransacao, docCandidato) => {
  const a = soNumeros(docTransacao), b = soNumeros(docCandidato);
  if (!a || !b) return { pts: 0, motivo: null };
  if (a === b) return { pts: 35, motivo: "CPF/CNPJ exato e exclusivo" };
  return { pts: 0, motivo: null };
};

const pontuarContraparte = (nomeTransacao, nomeCandidato) => {
  const normalizar = value => semAcento(value).replace(/[^a-z0-9]+/g, " ").trim();
  const a = normalizar(nomeTransacao), b = normalizar(nomeCandidato);
  if (!a || !b) return { pts: 0, motivo: null };
  if (a === b) return { pts: 15, motivo: "Nome da contraparte exato" };
  if (Math.min(a.length, b.length) >= 5 && (` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `))) return { pts: 10, motivo: "Nome da contraparte semelhante" };
  return { pts: 0, motivo: null };
};

const pontuarData = (dataTransacao, dataPrevista) => {
  if (!dataPrevista) return { pts: 0, motivo: null };
  const dist = diasEntre(dataTransacao, dataPrevista);
  if (dist <= 2) return { pts: 12, motivo: "Data até dois dias da previsão" };
  if (dist <= 7) return { pts: 7, motivo: "Data até sete dias da previsão" };
  if (dist <= 15) return { pts: 2, motivo: null };
  return { pts: 0, motivo: null };
};

const normalizarChavePix = value => String(value || "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, "");
const pontuarPix = (transacao, pixKeyCandidato) => {
  if (!pixKeyCandidato) return { pts: 0, motivo: null };
  // Só considera chave quando ela veio estruturada do extrato. Trechos da
  // descrição são evidência fraca e jamais uma confirmação conclusiva.
  const chave = normalizarChavePix(transacao.chavePix || transacao.pixKey || transacao.chave || "");
  if (chave && chave === normalizarChavePix(pixKeyCandidato)) return { pts: 35, motivo: "Chave PIX exata e exclusiva" };
  return { pts: 0, motivo: null };
};

const pontuarIdentificadorBancario = (transacao, item) => {
  const id=[transacao?.fitid,transacao?.endToEndId,transacao?.txid].filter(Boolean).map(String);
  const origem=[item?.fitid,item?.endToEndId,item?.txid,item?.identificadorBancario].filter(Boolean).map(String);
  return id.some(value=>origem.includes(value))?{pts:60,motivo:"Identificador bancário único já vinculado ao fato"}:{pts:0,motivo:null};
};

const periodoFechado = (data, transacao) => (data.fechamentosBancarios||[]).some(item =>
  item.status==="fechado" && (!item.contaBancariaId || !transacao?.contaBancariaId || String(item.contaBancariaId)===String(transacao.contaBancariaId)) &&
  String(transacao?.data||"")>=String(item.dataInicio||"") && String(transacao?.data||"")<=String(item.dataFim||"")
);

const pontuarObra = (obraTransacao, obraCandidato) => {
  if (!obraTransacao || !obraCandidato) return { pts: 0, motivo: null };
  return obraTransacao === obraCandidato ? { pts: 5, motivo: null } : { pts: 0, motivo: null };
};

// Gera candidatas para UMA transação, a partir dos índices já montados.
// `config` permite ajustar tolerância/automação sem mexer no motor:
// { toleranciaCentavos, permitirAutomatica }
export const gerarCandidatosConciliacao = (transacao, data, indices, config = {}) => {
  const usados = transacoesConsumidas(data);
  const valorCentavos = paraCentavos(transacao.valor);
  const isEntrada = Number(transacao.valor) > 0;
  const relevantes = new Map();
  if (!Number.isFinite(valorCentavos) || valorCentavos === 0) return [];

  const coletar = (chave, mapa) => (mapa?.get(chave) || []).forEach(e => relevantes.set(`${e.tipo}:${e.item.id}`, e));

  coletar(paraCentavos(Math.abs(Number(transacao.valor))), indices.porValorCentavos);
  // Busca por faixa em índice ordenado: encontra diferenças de centavos
  // sem varrer toda a carteira para cada linha do extrato. Tolerância só
  // descobre candidatas; a validação do saldo continua estrita abaixo.
  const valores = indices.valoresOrdenados || [];
  const tolerancia = Math.max(0, Number(config.toleranciaCentavos ?? 100));
  const minimo = Math.abs(valorCentavos) - tolerancia, maximo = Math.abs(valorCentavos) + tolerancia;
  let esquerda = 0, direita = valores.length;
  while (esquerda < direita) {
    const meio = Math.floor((esquerda + direita) / 2);
    if (valores[meio] < minimo) esquerda = meio + 1; else direita = meio;
  }
  for (let index = esquerda; index < valores.length && valores[index] <= maximo; index += 1) coletar(valores[index], indices.porValorCentavos);
  const documentoTransacao = transacao.contraparteDocumento || transacao.cpfCnpj;
  const nomeTransacao = transacao.contraparteNome || transacao.nomeContraparte || transacao.descricao;
  if (documentoTransacao) coletar(soNumeros(documentoTransacao), indices.porDocumento);
  if (nomeTransacao) coletar(semAcento(nomeTransacao), indices.porContraparte);
  // Bancos frequentemente entregam só "PIX NOME DO FORNECEDOR". O índice
  // invertido reduz a busca por descrição aos nomes que compartilham tokens;
  // exigimos o nome completo antes de incluí-los como evidência semelhante.
  tokensContraparte(nomeTransacao).forEach(token => (indices.porTokenContraparte?.get(token) || []).forEach(entry => {
    if (pontuarContraparte(nomeTransacao, entry.contraparte).pts) relevantes.set(`${entry.tipo}:${entry.item.id}`, entry);
  }));
  [transacao.fitid, transacao.endToEndId, transacao.txid].filter(Boolean).forEach(id => coletar(String(id), indices.porIdentificadorBancario));
  // `chave` é o campo estruturado legado do importador; não é a descrição.
  if (transacao.chavePix || transacao.pixKey || transacao.chave) coletar(normalizarChavePix(transacao.chavePix || transacao.pixKey || transacao.chave), indices.porPixChave);

  const candidatas = [];

  relevantes.forEach(({ tipo, item, obraId, documento: documentoIndice = "", contraparte: contraparteIndice = "", pixKey: pixIndice = "", categoria = "", valorCentavos: valorIndexado = 0 }) => {
    // Vínculos antigos sem uma liquidação identificável continuam reservando
    // o fato inteiro. Liquidações comprovadas são consumidas pelo ID do
    // pagamento, preservando o saldo residual do título no índice.
    if (usados.has(`${tipo}:${item.id}`) && !["medicao", "entradaContrato"].includes(tipo)) return;

    let saldoCentavos = 0, documento = documentoIndice, contraparte = contraparteIndice, dataPrevista = "", pixKey = pixIndice, titulo = "", podeVincular = false, podeRegistrarPagamento = false, entidadeId = item.id, pagamentoId = null, tipoCandidata = tipo;

    if (tipo === "pagamentoNota") {
      // Pagamento JÁ registrado (ex.: pela Central de Pagamentos), só falta
      // ligar a transação bancária a ele - modo A, não cria nada novo.
      if (isEntrada) return;
      saldoCentavos = paraCentavos(item.valor);
      dataPrevista = item.data || item.date;
      titulo = `Pagamento já registrado · Nota ${item.nota?.numero || ""}`.trim();
      podeVincular = true;
      entidadeId = item.nota?.id;
      pagamentoId = item.id;
    } else if (tipo === "pagamentoPedido") {
      if (isEntrada) return;
      saldoCentavos = paraCentavos(item.valor);
      dataPrevista = item.data || item.date;
      titulo = `Pagamento já registrado · Pedido ${item.pedido?.numero || ""}`.trim();
      podeVincular = true;
      entidadeId = item.pedido?.id;
      pagamentoId = item.id;
    } else if (tipo === "nota") {
      if (isEntrada) return; // nota fiscal só se paga com saída
      saldoCentavos = paraCentavos(saldoPagamentoNota(item));
      dataPrevista = item.vencimento;
      titulo = `Nota Fiscal ${item.numero || ""}`.trim();
      podeRegistrarPagamento = saldoCentavos > 0;
    } else if (tipo === "pedido") {
      if (isEntrada) return;
      saldoCentavos = paraCentavos(saldoPagamentoPedido(item));
      dataPrevista = item.previsao;
      titulo = `Pedido ${item.numero || ""}`.trim();
      podeRegistrarPagamento = saldoCentavos > 0;
    } else if (tipo === "medicaoTerc") {
      if (isEntrada) return;
      saldoCentavos = valorIndexado;
      dataPrevista = item.data;
      titulo = `Medição de terceiro nº${item.numero || ""}`.trim();
      podeRegistrarPagamento = true;
    } else if (tipo === "medicao") {
      if (!isEntrada) return; // recebimento de medição/parcela de contrato é sempre entrada
      saldoCentavos = paraCentavos(Number(item.valorPrevisto || 0) - totalRecebidoMedicao(item));
      dataPrevista = item.dataVencimento;
      // "medicao" no banco de dados cobre tanto parcela fixa de contrato
      // (mensal_fixo/livre) quanto medição técnica por % de avanço - o
      // rótulo distingue as duas para não confundir o usuário na fila.
      titulo = (item.tipo === "percentual" ? "Medição" : "Parcela do contrato") + (item.competencia ? ` ${item.competencia}` : "");
      podeRegistrarPagamento = true;
    } else if (tipo === "entradaContrato") {
      if (!isEntrada) return;
      const totalRecebido = Array.isArray(item.recebimentosEntrada)
        ? item.recebimentosEntrada.reduce((s, recebimento) => s + Number(recebimento.valor || 0), 0)
        : (item.entradaPaga ? Number(item.entrada || 0) : 0);
      saldoCentavos = paraCentavos(Number(item.entrada || 0) - totalRecebido);
      dataPrevista = item.inicio;
      titulo = `Entrada do contrato ${item.numero || ""}`.trim();
      podeRegistrarPagamento = saldoCentavos > 0;
    } else if (tipo === "recebimentoMedicao") {
      if (!isEntrada) return;
      tipoCandidata = "medicao";
      saldoCentavos = paraCentavos(item.valor);
      dataPrevista = item.data || item.date;
      titulo = `Recebimento já registrado · ${item.medicao?.descricao || "Parcela do contrato"}`;
      entidadeId = item.medicao?.id;
      pagamentoId = item.id;
      podeVincular = true;
    } else if (tipo === "tituloFolha" || tipo === "liquidacaoFolha") {
      if (isEntrada) return;
      const title = item.tituloFolha || item;
      const employee = (data.employees || []).find(e => e.id === title.employeeId) || {};
      const resumoFolha = resumoTituloFolha(title, employee);
      saldoCentavos = paraCentavos(tipo === "liquidacaoFolha" ? item.valor : saldoTituloFolha(title));
      contraparte = resumoFolha.funcionario;
      dataPrevista = tipo === "liquidacaoFolha" ? item.data || item.date : title.vencimento || title.periodoFim;
      titulo = `${tipo === "liquidacaoFolha" ? "Pagamento de folha já registrado" : "Folha"} · ${resumoFolha.funcionario} · ${resumoFolha.periodo}`;
      podeRegistrarPagamento = tipo === "tituloFolha" && saldoCentavos > 0;
      podeVincular = tipo === "liquidacaoFolha";
      pagamentoId = podeVincular ? item.id : null;
      tipoCandidata = "tituloFolha";
      // A tela usa estes dados para exibir o cálculo/rateio antes de qualquer
      // confirmação. Não cria despesa no DRE: só liquida o título.
      entidadeId = title.id;
    } else if (tipo === "pagamentoFolha") {
      if (isEntrada) return;
      tipoCandidata = "funcionario";
      saldoCentavos = paraCentavos(item.valor);
      dataPrevista = item.data || item.date;
      titulo = `Pagamento de salário já registrado · ${contraparte}`;
      entidadeId = item.employee?.id;
      pagamentoId = item.id;
      podeVincular = true;
    } else if (tipo === "funcionario") {
      if (isEntrada) return;
      contraparte = item.name || item.nome;
      pixKey = item.pixKey;
      titulo = `Pagamento a ${contraparte}`;
      podeRegistrarPagamento = true;
      entidadeId = item.id;
    } else if (tipo === "terceiro") {
      if (isEntrada) return;
      contraparte = item.nome || item.name;
      titulo = `Terceiro ${contraparte || ""}`.trim();
      podeRegistrarPagamento = true;
    } else if (tipo === "caixaObra") {
      // Aporte (cliente deposita no caixa da obra) só serve de candidata para
      // ENTRADA; despesa do caixa só serve para SAÍDA - sem isso um crédito
      // bancário podia sugerir vínculo com uma despesa já paga em dinheiro.
      if ((item._direcao === "entrada") !== isEntrada) return;
      saldoCentavos = paraCentavos(Math.abs(item.valor));
      dataPrevista = item.data;
      titulo = item._direcao === "entrada" ? "Aporte no caixa da obra" : "Despesa do caixa da obra";
      podeVincular = true;
      pagamentoId = item.id;
    } else if (["outrasDesp", "despesasEmpresa", "payments"].includes(tipo)) {
      if ((tipo === "payments") !== isEntrada) return;
      saldoCentavos = paraCentavos(item.amount || item.valor);
      dataPrevista = item.dataPagamento || item.data || item.date;
      titulo = `${tipo === "payments" ? "Recebimento já registrado" : "Despesa já registrada"} · ${item.description || item.descricao || categoria}`;
      pagamentoId = item.id;
      podeVincular = true;
    } else {
      return;
    }

    const party = contraparteDoFato(data, tipo, item);
    documento = documento || party.documento;
    contraparte = contraparte || party.nome;
    pixKey = pixKey || party.pix;
    let score = 0;
    const motivos = [], alertas = [], bloqueios = [];

    if (item.status === "cancelado" || item.status === "cancelada") {
      bloqueios.push("O fato financeiro está cancelado");
    }
    if (periodoFechado(data, transacao)) bloqueios.push("A transação pertence a um período financeiro fechado");
    if (saldoCentavos > 0) {
      const v = pontuarValor(valorCentavos, saldoCentavos);
      score += v.pts; if (v.motivo) motivos.push(v.motivo);
      if (Math.abs(valorCentavos) > saldoCentavos + 1) {
        bloqueios.push("Valor do movimento é maior que o saldo em aberto");
      }
    }
    if (podeVincular && Math.abs(Math.abs(valorCentavos) - saldoCentavos) > 1) {
      bloqueios.push("O valor do movimento diverge do pagamento existente. Use os vínculos parciais para distribuir valores.");
    }
    const d = pontuarDocumento(documentoTransacao, documento);
    score += d.pts; if (d.motivo) motivos.push(d.motivo);
    if (documentoTransacao && documento && soNumeros(documentoTransacao) !== soNumeros(documento) && d.pts === 0 && documento) {
      alertas.push("CPF/CNPJ informado não confere com o candidato");
      bloqueios.push("CPF/CNPJ incompatível com o fato financeiro");
    }
    const c = pontuarContraparte(nomeTransacao, contraparte);
    score += c.pts; if (c.motivo) motivos.push(c.motivo);
    const dt = pontuarData(transacao.data, dataPrevista);
    score += dt.pts; if (dt.motivo) motivos.push(dt.motivo);
    const px = pontuarPix(transacao, pixKey);
    score += px.pts; if (px.motivo) motivos.push(px.motivo);
    const bankId=pontuarIdentificadorBancario(transacao,item);
    score += bankId.pts;if(bankId.motivo)motivos.push(bankId.motivo);
    const ob = pontuarObra(transacao.obraId, obraId);
    score += ob.pts;

    // Identificar a pessoa não comprova o valor devido. Cadastros sem um
    // título nunca entram na confirmação em lote só por CPF + PIX + nome.
    if (["funcionario", "terceiro"].includes(tipo)) {
      score = Math.min(score, 59);
      alertas.push("Cadastro identificado; confira a obrigação e o valor antes de registrar o pagamento.");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const confianca = faixaDoScore(score, alertas.length > 0);

    const title = item.tituloFolha || item;
    const metadados = tipoCandidata === "tituloFolha"
      ? { itemId: item.id, categoria, payroll: resumoTituloFolha(title, (data.employees || []).find(e => e.id === title.employeeId) || {}) }
      : { itemId: item.id, categoria };
    candidatas.push(candidata({
      tipo: tipoCandidata, entidadeId, pagamentoId, obraId, titulo, contraparte, documento, categoria,
      dataPrevista, valorOriginalCentavos: saldoCentavos, saldoCentavos,
      podeVincular: podeVincular && bloqueios.length === 0,
      podeRegistrarPagamento: podeRegistrarPagamento && bloqueios.length === 0,
      metadados,
    }));
    const last = candidatas[candidatas.length - 1];
    last.evidenciaAutomatica = {
      identidadeExata: (d.pts > 0 && [11,14].includes(soNumeros(documento).length)) || px.pts > 0,
      referenciaExata: bankId.pts > 0,
      valorExato: saldoCentavos > 0 && Math.abs(valorCentavos) === saldoCentavos,
      dataProxima: Boolean(transacao.data && dataPrevista && diasEntre(transacao.data, dataPrevista) <= 2),
    };
    if ((transacao.chavePix || transacao.pixKey || transacao.chave) && pixKey && !px.pts) {
      bloqueios.push("Chave PIX incompatível com o fato financeiro");
      last.podeVincular = false;
      last.podeRegistrarPagamento = false;
    }
    last.score = score; last.confianca = confianca;
    last.motivos = motivos; last.alertas = alertas; last.bloqueios = bloqueios;
  });

  // Chave PIX já cadastrada na base (conta da própria empresa, funcionário,
  // terceiro, fornecedor ou proprietário de equipamento) - busca automática
  // pedida explicitamente: mesmo sem nota/pedido em aberto, a contraparte já
  // é conhecida, e isso é informação relevante para classificar a transação.
  const pixRegistrado = buscarPixRegistrado(indices,
    transacao.chavePix || transacao.pixKey || transacao.chave
    || transacao.contraparteDocumento || transacao.descricao);
  if (pixRegistrado && !candidatas.some(c => c.tipo === "pixRegistrado")) {
    const rotulos = { empresa: "conta da própria empresa", funcionario: "funcionário", terceiro: "terceirizado", fornecedor: "fornecedor", proprietarioEquip: "proprietário de equipamento" };
    const ehEmpresa = pixRegistrado.tipo === "empresa";
    const c = candidata({
      tipo: "pixRegistrado", entidadeId: pixRegistrado.id, obraId: null,
      titulo: `PIX cadastrado: ${pixRegistrado.nome || rotulos[pixRegistrado.tipo]}`,
      contraparte: pixRegistrado.nome, valorOriginalCentavos: valorCentavos, saldoCentavos: valorCentavos,
      podeVincular: false, podeRegistrarPagamento: false,
      metadados: { pixTipo: pixRegistrado.tipo },
    });
    c.score = ehEmpresa ? 40 : 25;
    c.confianca = faixaDoScore(c.score, !!pixRegistrado.duplicado);
    if (pixRegistrado.duplicado) c.alertas = ["A chave PIX está vinculada a mais de uma contraparte cadastrada; escolha manualmente."];
    c.motivos = [ehEmpresa
      ? "Esta chave PIX já está cadastrada como uma conta da própria empresa - provável transferência interna, não receita/despesa nova"
      : `Esta chave PIX já está cadastrada na base como ${rotulos[pixRegistrado.tipo]}: ${pixRegistrado.nome}`];
    candidatas.push(c);
  }

  const ordenadas = candidatas.sort((a, b) => b.score - a.score);
  // Pré-seleção é só conveniência visual: exige pontuação forte, nenhum
  // bloqueio e distância suficiente para a segunda alternativa. A execução
  // continua sempre dependente da confirmação humana.
  const margem = Number(config.margemEntreCandidatos ?? 15);
  ordenadas.forEach((candidate, index) => {
    const second = ordenadas[index + 1];
    candidate.preSelecionavel = !candidate.bloqueios.length && candidate.score >= Number(config.pontuacaoMinima ?? 80) &&
      (!second || candidate.score - second.score >= margem);
    if (candidate.preSelecionavel === false && second && candidate.score - second.score < margem) {
      candidate.alertas.push("Há outra candidata com pontuação próxima; escolha manualmente.");
    }
  });
  return ordenadas;
};
