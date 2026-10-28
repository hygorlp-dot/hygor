import { statusPedido, statusPagamentoPedido, totalPedido } from "./calculations";
import { cotacaoMultiItens, itensDaCotacao, itensPendentesDaCotacao } from "./quote-map";
import { atrasoDoItem } from "./delivery-schedule";

const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export const matchesPurchaseSearch = (query, ...values) => {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalize(values.flat(Infinity).filter(value => value != null).join(" "));
  return terms.every(term => haystack.includes(term));
};

export const purchaseDeadline = (date, today) => {
  if (!date) return { label:"Sem prazo", tone:"neutral", rank:3 };
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
  if (!Number.isFinite(days)) return { label:"Sem prazo", tone:"neutral", rank:3 };
  return days < 0 ? { label:`${Math.abs(days)} dia(s) de atraso`, tone:"danger", rank:0 }
    : days === 0 ? { label:"Vence hoje", tone:"warning", rank:1 }
      : days <= 3 ? { label:`Em ${days} dia(s)`, tone:"warning", rank:1 }
        : { label:"No prazo", tone:"success", rank:2 };
};

// Projection only: no transitions, totals or approval decisions are persisted here.
export function buildPurchaseWorkspace(data, obraIds, today) {
  const visible = record => obraIds.includes(record.obraId);
  const obras = new Map((data.obras || []).map(item => [item.id, item]));
  const materials = new Map((data.materiais || []).map(item => [item.id, item]));
  const suppliers = new Map((data.fornecedores || []).map(item => [item.id, item]));
  const approvals = new Map((data.instanciasAprovacao || []).map(item => [item.id, item]));
  const requests = new Map((data.solicitacoesCompra || []).map(item => [item.id, item]));
  const activeQuotes = (data.cotacoes || []).filter(item => item.status === "aberta" &&
    (cotacaoMultiItens(item) ? itensPendentesDaCotacao(item).length > 0 : !item.pedidoId));
  const quotedRequests = new Set(activeQuotes.map(item => item.solicitacaoId).filter(Boolean));
  const rows = [];
  const add = (record, details) => rows.push({
    id:record.id, record, obraId:record.obraId || "", obra:obras.get(record.obraId)?.name || "Obra não informada",
    code:record.numero || record.id, ...details,
    deadline:purchaseDeadline(details.date, today),
  });
  for (const request of (data.solicitacoesCompra || []).filter(visible)) {
    if (["cancelada", "pedido_gerado"].includes(request.status)) continue;
    const approval = approvals.get(request.aprovacaoInstanciaId);
    const blocked = approval && approval.status !== "aprovada";
    if (!blocked && quotedRequests.has(request.id)) continue;
    const eligible = (approval?.resultadosEtapas || []).filter(item => item.status === "em_andamento")
      .flatMap(item => item.aprovadoresElegiveis || []);
    add(request, { type:"request", stage:blocked ? "aprovacoes" : "solicitacoes",
      title:(request.itens || []).map(item => item.descricaoRef).filter(Boolean).join(" · ") || "Materiais solicitados",
      detail:blocked ? ({em_andamento:"Aguardando aprovação", bloqueada:"Configuração da aprovação pendente", reprovada:"Solicitação reprovada"}[approval.status] || "Revisar aprovação")
        : request.status === "enviada" ? "Aguardando análise de Compras" : "Em análise · preparar cotação",
      responsible:blocked ? [...new Set(eligible.map(item => item.nome || item.email).filter(Boolean))].join(", ") || "Aprovador não informado"
        : request.solicitanteNome || "Solicitante não informado",
      date:request.necessidade, action:blocked ? "Ver aprovação" : "Analisar solicitação", total:null,
    });
  }
  for (const quote of activeQuotes.filter(visible)) {
    add(quote, { type:"quote", stage:"cotacoes",
      title:itensDaCotacao(quote).map(item => materials.get(item.materialId)?.descricao || item.descricaoRef || "Material não informado").join(" · "),
      detail:`${(quote.propostas || []).length} proposta(s) · comparar preço e condições`,
      responsible:(quote.propostas || []).map(item => suppliers.get(item.fornecedorId)?.nome).filter(Boolean).join(", ") || "Fornecedor não informado",
      date:requests.get(quote.solicitacaoId)?.necessidade, action:"Comparar propostas", total:null,
    });
  }
  const orders = (data.pedidos || []).filter(visible).filter(item => statusPedido(item) !== "cancelado");
  for (const order of orders) {
    const status = statusPedido(order);
    if (status === "recebido") continue;
    const dates = (order.itens || []).filter(item => Number(item.qtd) > Number(item.qtdRecebida || 0))
      .map(item => { const delivery = atrasoDoItem(item, order, today); return delivery.proximaData; }).filter(Boolean).sort();
    add(order, { type:"order", stage:status === "rascunho" ? "pedidos" : "recebimentos",
      title:(order.itens || []).map(item => materials.get(item.materialId)?.descricao || item.descricaoRef || "Material não informado").join(" · "),
      detail:`${status === "rascunho" ? "Rascunho · conferir antes de enviar" : status === "parcial" ? "Entrega parcial · conferir o saldo" : "Aguardando entrega"} · ${statusPagamentoPedido(order) === "pago" ? "Pago" : "Pagamento em aberto"}`,
      responsible:suppliers.get(order.fornecedorId)?.nome || "Fornecedor não informado",
      supplierId:order.fornecedorId || "",
      date:dates[0] || order.previsao, action:status === "rascunho" ? "Revisar pedido" : "Receber materiais", total:totalPedido(order),
    });
  }
  rows.sort((a, b) => a.deadline.rank - b.deadline.rank || String(a.date || "9999").localeCompare(String(b.date || "9999")) || String(a.code).localeCompare(String(b.code)));
  return { rows, counts:Object.fromEntries(["solicitacoes", "cotacoes", "aprovacoes", "pedidos", "recebimentos"].map(stage => [stage, rows.filter(row => row.stage === stage).length])),
    overdue:rows.filter(row => row.deadline.tone === "danger").length,
    attention:rows.filter(row => row.deadline.tone === "warning").length,
  };
}
