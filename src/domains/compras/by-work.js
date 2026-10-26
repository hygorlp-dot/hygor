// Comparativo de compras entre obras. Projeção somente de leitura: reaproveita
// o orçado × comprometido (budget-tracking) e a fila (workspace) para que os
// números daqui batam com as telas de cada obra; nada é gravado.
import { calcOrcadoComprado } from "./budget-tracking.js";
import { pendentePedido, saldoPagamentoPedido, statusPedido, totalPedido } from "./calculations";
import { buildPurchaseWorkspace } from "./workspace";

const COMPROMETIDO = new Set(["enviado", "parcial", "recebido"]);
const A_RECEBER = new Set(["enviado", "parcial"]);
const soma = (lista, valor) => lista.reduce((total, item) => total + valor(item), 0);

// Gravidade para ordenar: 0 estourou o orçamento · 1 entrega atrasada ·
// 2 perto do limite (90%) · 3 sem alerta. Dentro de cada nível, mais atrasos e
// maior % do orçamento primeiro.
const gravidade = linha => {
  if (linha.estouradas > 0 || (linha.pctOrcado != null && linha.pctOrcado > 100)) return 0;
  if (linha.atrasados > 0) return 1;
  if (linha.atencaoOrcamento > 0 || (linha.pctOrcado != null && linha.pctOrcado >= 90)) return 2;
  return 3;
};

export function buildPurchasesByWork(data, obras, today) {
  const ids = obras.map(obra => obra.id);
  const fluxo = buildPurchaseWorkspace(data, ids, today);
  const prazos = new Map(ids.map(id => [id, { andamento: 0, atrasados: 0, atencaoPrazo: 0, aprovacoes: 0 }]));
  fluxo.rows.forEach(row => {
    const acumulado = prazos.get(row.record.obraId);
    if (!acumulado) return;
    acumulado.andamento += 1;
    if (row.deadline.tone === "danger") acumulado.atrasados += 1;
    else if (row.deadline.tone === "warning") acumulado.atencaoPrazo += 1;
    if (row.stage === "aprovacoes") acumulado.aprovacoes += 1;
  });

  const linhas = obras.map(obra => {
    const pedidos = (data.pedidos || []).filter(pedido => pedido.obraId === obra.id && pedido.status !== "cancelado");
    const comPedido = pedidos.filter(pedido => COMPROMETIDO.has(statusPedido(pedido)));
    const controle = calcOrcadoComprado(data, obra.id);
    const temControle = Boolean(controle.orc);
    const orcado = temControle ? soma(controle.linhas, linha => linha.orcado) : 0;
    // Com orçamento de controle o comprometido segue a mesma valoração da tela
    // "Orçado × comprado" (inclui o que está sem apropriação); sem ele, é a
    // soma direta dos pedidos enviados, parciais e recebidos.
    const comprometido = temControle
      ? soma(controle.linhas, linha => linha.comprometido) + controle.semApropriacao
      : soma(comPedido, totalPedido);
    const resumoPrazos = prazos.get(obra.id);
    const linha = {
      obraId: obra.id, obra: obra.name || "Obra sem nome",
      temControle, motivoSemControle: controle.motivo, temOrcamento: controle.temOrcamento,
      orcado, comprometido,
      pctOrcado: temControle && orcado > 0 ? (comprometido / orcado) * 100 : null,
      estouradas: temControle ? controle.linhas.filter(item => item.alerta === "estourou").length : 0,
      atencaoOrcamento: temControle ? controle.linhas.filter(item => item.alerta === "atencao").length : 0,
      aReceber: soma(pedidos.filter(pedido => A_RECEBER.has(statusPedido(pedido))), pendentePedido),
      aPagar: soma(pedidos.filter(pedido => statusPedido(pedido) !== "rascunho"), saldoPagamentoPedido),
      ...resumoPrazos,
    };
    return { ...linha, gravidade: gravidade(linha) };
  }).sort((a, b) => a.gravidade - b.gravidade
    || b.atrasados - a.atrasados
    || (b.pctOrcado ?? -1) - (a.pctOrcado ?? -1)
    || a.obra.localeCompare(b.obra, "pt-BR"));

  const comControle = linhas.filter(linha => linha.temControle);
  const totais = {
    obras: linhas.length, semControle: linhas.length - comControle.length,
    orcado: soma(comControle, linha => linha.orcado),
    comprometidoComControle: soma(comControle, linha => linha.comprometido),
    comprometido: soma(linhas, linha => linha.comprometido),
    aReceber: soma(linhas, linha => linha.aReceber),
    aPagar: soma(linhas, linha => linha.aPagar),
    atrasados: soma(linhas, linha => linha.atrasados),
    andamento: soma(linhas, linha => linha.andamento),
  };
  totais.pctOrcado = totais.orcado > 0 ? (totais.comprometidoComControle / totais.orcado) * 100 : null;
  return { linhas, totais };
}
