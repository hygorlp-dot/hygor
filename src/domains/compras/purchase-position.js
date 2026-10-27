// Posição de uma compra: a ÚNICA definição de "comprometido" fora do razão.
//
// Antes, cada tela somava os pedidos do seu jeito (com rascunho, sem rascunho,
// pelo status gravado, pelo derivado) e a mesma obra mostrava números
// diferentes. Aqui fica a regra:
//   viva         = pedido enviado (parcial ou recebido); rascunho e cancelado
//                  não comprometem nada
//   comprometido = valor bruto do pedido vivo
//   faturado     = notas fiscais que o razão reconhece (as mesmas do DRE), até o
//                  valor do pedido
//   aFaturar     = comprometido - faturado: o que ainda não virou nota
// O razão (financeiro/ledger.js) mede o comprometido líquido da nota, com a data
// do pedido; "aFaturar" é o mesmo número visto por pedido.
import { fromCents, invoiceAmount, notaReconhecivel } from "../financeiro/ledger.js";

export const pedidoVivo = pedido =>
  Boolean(pedido)
  && !["cancelado", "rascunho"].includes(pedido.status)
  && pedido.deletedAt == null
  && pedido.ativo !== false;

export const valorBrutoDoPedido = pedido => (pedido?.itens || [])
  .reduce((soma, item) => soma + Number(item.qtd || 0) * Number(item.precoUnit || 0), 0);

export const faturadoDoPedido = (pedido, notasFiscais = []) => {
  const faturado = (notasFiscais || [])
    .filter(nota => String(nota?.pedidoId || "") === String(pedido?.id) && notaReconhecivel(nota))
    .reduce((soma, nota) => soma + fromCents(invoiceAmount(nota)), 0);
  return Math.min(faturado, valorBrutoDoPedido(pedido));
};

export const posicaoDoPedido = (pedido, notasFiscais = []) => {
  const viva = pedidoVivo(pedido);
  const comprometido = viva ? valorBrutoDoPedido(pedido) : 0;
  const faturado = viva ? faturadoDoPedido(pedido, notasFiscais) : 0;
  return { viva, comprometido, faturado, aFaturar: Math.max(0, comprometido - faturado) };
};

export const posicaoDasCompras = (pedidos = [], notasFiscais = []) =>
  (pedidos || []).reduce((total, pedido) => {
    const posicao = posicaoDoPedido(pedido, notasFiscais);
    return {
      comprometido: total.comprometido + posicao.comprometido,
      faturado: total.faturado + posicao.faturado,
      aFaturar: total.aFaturar + posicao.aFaturar,
    };
  }, { comprometido: 0, faturado: 0, aFaturar: 0 });
