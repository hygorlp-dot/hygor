import { totalPedido } from "./calculations.js";
import { entregasAvaliadas } from "./delivery-schedule.js";
import { decisoesDaCotacao, itensDaCotacao, precoDaProposta } from "./quote-map.js";

export function supplierQuoteSamples(quotes) {
  return quotes.flatMap(quote => {
    const pending = new Set((quote.respostasFornecedor || []).filter(row => row.status === "pendente").map(row => row.proposalId));
    const proposals = (quote.propostas || []).filter(row => !pending.has(row.id));
    const items = itensDaCotacao(quote);
    const decisions = decisoesDaCotacao(quote);
    return (items.length ? items : [null]).flatMap(item => {
      const offers = proposals.map(proposal => ({
        proposal,
        preco: (item ? precoDaProposta(quote, proposal, item.id) : 0) ||
          (!quote.itens?.length ? Number(proposal.precoUnit || proposal.preco) : 0),
        prazo: Number(proposal.prazoDias || proposal.prazo || 0),
      })).filter(offer => Number.isFinite(offer.preco) && offer.preco > 0);
      const menorPreco = Math.min(...offers.map(offer => offer.preco));
      const prazos = offers.map(offer => offer.prazo).filter(value => Number.isFinite(value) && value > 0);
      const menorPrazo = prazos.length ? Math.min(...prazos) : 0;
      return offers.map(({proposal, preco, prazo}) => ({
        ...proposal, cotacao: quote, itemId: item?.id || "", preco, prazo, menorPreco, menorPrazo,
        vitoria: quote.itens?.length ? decisions[item?.id]?.propostaId === proposal.id
          : quote.escolhida === proposal.id || quote.fornecedorId === proposal.fornecedorId,
      }));
    });
  });
}

export function supplierOrderEvidence(orders, samples) {
  const quoteById = new Map(samples.map(sample => [sample.cotacao.id, sample.cotacao]));
  const deliveries = entregasAvaliadas(orders, "").filter(row => !row.pendente);
  return orders.map(order => {
    const quote = quoteById.get(order.cotacaoId);
    const linkedQuote = quote?.obraId === order.obraId ? quote : null;
    const orderSamples = linkedQuote ? samples.filter(sample => sample.cotacao.id === linkedQuote.id) : [];
    const promisedDays = [...new Set(orderSamples.map(sample => sample.prazo).filter(value => Number.isFinite(value) && value > 0))];
    return {
      order, total: totalPedido(order), quote: linkedQuote, promisedDays,
      deliveries: deliveries.filter(row => row.pedidoId === order.id),
    };
  }).sort((a, b) => String(b.order.data || b.order.criadoEm || "").localeCompare(String(a.order.data || a.order.criadoEm || "")));
}
