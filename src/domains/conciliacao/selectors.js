// Índices de busca do motor de conciliação. Sem React, DOM ou persistência.
//
// O objetivo é montar, UMA VEZ por render da fila (não por transação), mapas
// que o motor de matching consulta em O(1)/O(k) em vez de varrer todo
// notasFiscais/pedidos/terceirizados/employees/medicoes a cada transação
// (o que seria O(n×m) e pesado com listas grandes).
import { paraCentavos, semAcento } from "./calculations.js";

const push = (mapa, chave, item) => {
  if (!chave) return;
  const lista = mapa.get(chave);
  if (lista) lista.push(item);
  else mapa.set(chave, [item]);
};

const soNumeros = s => String(s || "").replace(/\D/g, "");

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
    if (pixKey) push(porPixChave, String(pixKey).trim(), entrada);
    if (obraId) push(porObra, obraId, entrada);
  };

  (data.notasFiscais || []).forEach(n => {
    const saldo = Number(n.valorLiquido || n.valorBruto || 0) -
      (n.pagamentos || []).reduce((s, p) => s + Number(p.valor || 0), 0);
    if (n.status === "cancelada") return;
    indexar(n, {
      tipo: "nota", valor: saldo, documento: n.documentoFornecedor || n.numero,
      contraparte: n.fornecedorNome, obraId: n.obraId,
    });
  });

  (data.pedidos || []).forEach(p => {
    if (p.status === "cancelado") return;
    const totalPago = (p.pagamentos || []).reduce((s, pg) => s + Number(pg.valor || 0), 0);
    const saldo = Number(p.totalPedido || 0) - totalPago;
    indexar(p, { tipo: "pedido", valor: saldo, documento: p.numero, obraId: p.obraId });
  });

  (data.terceirizados || []).forEach(t => {
    indexar(t, { tipo: "terceiro", valor: 0, documento: t.documento, contraparte: t.nome, pixKey: t.pixKey });
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

  (data.employees || []).filter(e => e.active !== false).forEach(e => {
    indexar(e, { tipo: "funcionario", valor: 0, contraparte: e.name || e.nome, pixKey: e.pixKey, obraId: e.obra });
  });

  (data.caixaObra || []).forEach(c => {
    if (c.conciliado) return;
    indexar(c, { tipo: "caixaObra", valor: c.valor, obraId: c.obraId });
  });

  return { porValorCentavos, porDocumento, porContraparte, porPixChave, porObra };
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
