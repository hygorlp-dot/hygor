// Motor de candidatos da conciliação. Sem React, DOM ou persistência.
//
// Dado um movimento bancário (transação) e os índices já montados
// (ver selectors.js), devolve uma lista de candidatas ordenadas por score -
// nunca uma decisão automática. A decisão de vincular, pagar ou criar
// sempre passa por confirmação do usuário (ou por regra explícita
// aprovada), conforme as faixas de confiança abaixo.
import { paraCentavos, semAcento, diasEntre } from "./calculations.js";
import { transacoesConsumidas } from "./selectors.js";

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
const candidata = (base) => ({
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
  if (a === b) return { pts: 25, motivo: "CPF/CNPJ coincidente" };
  return { pts: 0, motivo: null };
};

const pontuarContraparte = (nomeTransacao, nomeCandidato) => {
  const a = semAcento(nomeTransacao), b = semAcento(nomeCandidato);
  if (!a || !b) return { pts: 0, motivo: null };
  if (a === b) return { pts: 10, motivo: "Nome da contraparte coincide" };
  if (a.includes(b) || b.includes(a)) return { pts: 6, motivo: "Nome da contraparte semelhante" };
  return { pts: 0, motivo: null };
};

const pontuarData = (dataTransacao, dataPrevista) => {
  if (!dataPrevista) return { pts: 0, motivo: null };
  const dist = diasEntre(dataTransacao, dataPrevista);
  if (dist <= 2) return { pts: 10, motivo: "Data próxima do vencimento/previsão" };
  if (dist <= 7) return { pts: 6, motivo: null };
  if (dist <= 15) return { pts: 2, motivo: null };
  return { pts: 0, motivo: null };
};

const pontuarPix = (transacao, pixKeyCandidato) => {
  if (!pixKeyCandidato) return { pts: 0, motivo: null };
  const chave = String(transacao.chave || transacao.contraparteDocumento || transacao.descricao || "");
  if (chave.includes(String(pixKeyCandidato))) return { pts: 15, motivo: "Chave PIX corresponde" };
  return { pts: 0, motivo: null };
};

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

  const coletar = (chave, mapa) => (mapa.get(chave) || []).forEach(e => relevantes.set(`${e.tipo}:${e.item.id}`, e));

  coletar(paraCentavos(Math.abs(Number(transacao.valor))), indices.porValorCentavos);
  if (transacao.contraparteDocumento) coletar(soNumeros(transacao.contraparteDocumento), indices.porDocumento);
  if (transacao.contraparteNome) coletar(semAcento(transacao.contraparteNome), indices.porContraparte);
  if (transacao.chave) coletar(String(transacao.chave).trim(), indices.porPixChave);

  const candidatas = [];

  relevantes.forEach(({ tipo, item, obraId }) => {
    if (usados.has(`${tipo}:${item.id}`)) return; // já consumido por outra transação

    let saldoCentavos = 0, documento = "", contraparte = "", dataPrevista = "", pixKey = "", titulo = "", podeVincular = false, podeRegistrarPagamento = false, entidadeId = item.id, pagamentoId = null;

    if (tipo === "pagamentoNota") {
      // Pagamento JÁ registrado (ex.: pela Central de Pagamentos), só falta
      // ligar a transação bancária a ele - modo A, não cria nada novo.
      if (isEntrada) return;
      saldoCentavos = Math.abs(valorCentavos);
      documento = item.nota?.documentoFornecedor;
      contraparte = item.nota?.fornecedorNome;
      titulo = `Pagamento já registrado · Nota ${item.nota?.numero || ""}`.trim();
      podeVincular = true;
      entidadeId = item.nota?.id;
      pagamentoId = item.id;
    } else if (tipo === "pagamentoPedido") {
      if (isEntrada) return;
      saldoCentavos = valorCentavos ? Math.abs(valorCentavos) : 0;
      documento = item.pedido?.numero;
      titulo = `Pagamento já registrado · Pedido ${item.pedido?.numero || ""}`.trim();
      podeVincular = true;
      entidadeId = item.pedido?.id;
      pagamentoId = item.id;
    } else if (tipo === "nota") {
      if (isEntrada) return; // nota fiscal só se paga com saída
      const totalPago = (item.pagamentos || []).reduce((s, p) => s + Number(p.valor || 0), 0);
      saldoCentavos = paraCentavos(Number(item.valorLiquido || item.valorBruto || 0) - totalPago);
      documento = item.documentoFornecedor;
      contraparte = item.fornecedorNome;
      dataPrevista = item.vencimento;
      titulo = `Nota Fiscal ${item.numero || ""}`.trim();
      podeRegistrarPagamento = saldoCentavos > 0;
    } else if (tipo === "pedido") {
      if (isEntrada) return;
      const totalPago = (item.pagamentos || []).reduce((s, p) => s + Number(p.valor || 0), 0);
      saldoCentavos = paraCentavos(Number(item.totalPedido || 0) - totalPago);
      documento = item.numero;
      dataPrevista = item.previsao;
      titulo = `Pedido ${item.numero || ""}`.trim();
      podeRegistrarPagamento = saldoCentavos > 0;
    } else if (tipo === "medicaoTerc") {
      if (isEntrada) return;
      saldoCentavos = paraCentavos(item.total);
      dataPrevista = item.data;
      titulo = `Medição de terceiro nº${item.numero || ""}`.trim();
      podeRegistrarPagamento = true;
    } else if (tipo === "medicao") {
      if (!isEntrada) return; // recebimento de medição é sempre entrada
      const totalRec = Array.isArray(item.recebimentos) && item.recebimentos.length
        ? item.recebimentos.reduce((s, r) => s + Number(r.valor || 0), 0)
        : Number(item.valorRecebido || 0);
      saldoCentavos = paraCentavos(Number(item.valorPrevisto || 0) - totalRec);
      dataPrevista = item.dataVencimento;
      titulo = `Medição ${item.competencia || ""}`.trim();
      podeRegistrarPagamento = true;
    } else if (tipo === "funcionario") {
      if (isEntrada) return;
      contraparte = item.name || item.nome;
      pixKey = item.pixKey;
      titulo = `Pagamento a ${contraparte}`;
      podeRegistrarPagamento = true;
      entidadeId = item.id;
    } else if (tipo === "terceiro") {
      if (isEntrada) return;
      contraparte = item.nome;
      documento = item.documento;
      pixKey = item.pixKey;
      titulo = `Terceiro ${contraparte || ""}`.trim();
      podeRegistrarPagamento = true;
    } else if (tipo === "caixaObra") {
      saldoCentavos = paraCentavos(Math.abs(item.valor));
      dataPrevista = item.data;
      titulo = `Lançamento de caixa da obra`;
      podeVincular = true;
    } else {
      return;
    }

    let score = 0;
    const motivos = [], alertas = [], bloqueios = [];

    if (saldoCentavos > 0) {
      const v = pontuarValor(valorCentavos, saldoCentavos);
      score += v.pts; if (v.motivo) motivos.push(v.motivo);
      if (Math.abs(valorCentavos) > saldoCentavos + 1) {
        bloqueios.push("Valor do movimento é maior que o saldo em aberto");
      }
    }
    const d = pontuarDocumento(transacao.contraparteDocumento, documento);
    score += d.pts; if (d.motivo) motivos.push(d.motivo);
    if (transacao.contraparteDocumento && documento && soNumeros(transacao.contraparteDocumento) !== soNumeros(documento) && d.pts === 0 && documento) {
      alertas.push("CPF/CNPJ informado não confere com o candidato");
    }
    const c = pontuarContraparte(transacao.contraparteNome || transacao.descricao, contraparte);
    score += c.pts; if (c.motivo) motivos.push(c.motivo);
    const dt = pontuarData(transacao.data, dataPrevista);
    score += dt.pts; if (dt.motivo) motivos.push(dt.motivo);
    const px = pontuarPix(transacao, pixKey);
    score += px.pts; if (px.motivo) motivos.push(px.motivo);
    const ob = pontuarObra(transacao.obraId, obraId);
    score += ob.pts;

    if (documento && titulo) score += 0; // já contabilizado via pontuarDocumento

    score = Math.max(0, Math.min(100, Math.round(score)));
    const confianca = faixaDoScore(score, alertas.length > 0);

    candidatas.push(candidata({
      tipo, entidadeId, pagamentoId, obraId, titulo, contraparte, documento,
      dataPrevista, valorOriginalCentavos: saldoCentavos, saldoCentavos,
      podeVincular: podeVincular && bloqueios.length === 0,
      podeRegistrarPagamento: podeRegistrarPagamento && bloqueios.length === 0,
      metadados: { itemId: item.id },
    }));
    const last = candidatas[candidatas.length - 1];
    last.score = score; last.confianca = confianca;
    last.motivos = motivos; last.alertas = alertas; last.bloqueios = bloqueios;
  });

  return candidatas.sort((a, b) => b.score - a.score);
};
