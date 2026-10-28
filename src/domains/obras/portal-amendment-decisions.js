// Decisão do cliente sobre aditivo, dada no portal (Onda 4.3 do roadmap).
//
// O portal não grava nos dados do ERP: a decisão do cliente fica na trilha
// de auditoria do portal (client_portal_audit_events, imutável, com data,
// usuário e referência). O ERP lê essa trilha e mostra a decisão no painel
// de aditivos, onde o administrador a efetiva no contrato com um clique
// (ADITIVO_CONTRATO_DECIDIDO, origem "portal"). Assim nenhuma escrita de
// contrato acontece fora do pipeline de comandos financeiros.

export const PORTAL_AMENDMENT_EVENT = "change_order_decision";
export const PORTAL_CHANGE_PREFIX = "aditivo-";

export const amendmentIdFromChangeId = changeId =>
  String(changeId || "").startsWith(PORTAL_CHANGE_PREFIX) ? String(changeId).slice(PORTAL_CHANGE_PREFIX.length) : "";

export const validarDecisaoDoCliente = ({ decision, comment } = {}) => {
  if (!["aprovado", "recusado"].includes(decision)) return "Escolha aprovar ou recusar a alteração.";
  if (String(comment || "").length > 500) return "O comentário pode ter até 500 caracteres.";
  return "";
};

// Última decisão do cliente por aditivo (o cliente pode mudar de ideia
// enquanto o ERP não efetivou; vale a mais recente).
export const decisoesDoClientePorAditivo = (events = []) => {
  const porAditivo = new Map();
  [...(events || [])]
    .filter(event => event?.event_type === PORTAL_AMENDMENT_EVENT && event?.metadata?.amendmentId)
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))
    .forEach(event => porAditivo.set(String(event.metadata.amendmentId), {
      decision:event.metadata.decision,
      comment:String(event.metadata.comment || ""),
      email:String(event.metadata.email || ""),
      at:String(event.created_at || ""),
      reference:String(event.correlation_id || ""),
    }));
  return porAditivo;
};

export const evidenciaDoPortal = decisao =>
  `Portal do cliente · ${decisao.email || "cliente"} · ${String(decisao.at || "").slice(0, 16).replace("T", " ")} · ref. ${String(decisao.reference || "").slice(0, 8)}`
    + (decisao.comment ? ` · "${decisao.comment}"` : "");
