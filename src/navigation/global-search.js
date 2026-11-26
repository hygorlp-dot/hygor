// @ts-check

/** @typedef {string | number | null | undefined} SearchLabel */
/** @typedef {{tipo: string, rotulo: string, sub: string, tabId: string, obraId: string}} SearchEntry */
/** @typedef {{nome?: SearchLabel, numero?: SearchLabel, titulo?: SearchLabel, servico?: string, documento?: string}} CommercialRecord */
/**
 * @typedef {{
 *   obras?: {id: string, name?: SearchLabel, address?: string, engineer?: string}[],
 *   employees?: {name?: SearchLabel, role?: string, active?: boolean}[],
 *   terceirizados?: {name?: SearchLabel, specialty?: string}[],
 *   equipamentos?: {nome?: SearchLabel, categoria?: string, ativo?: boolean}[],
 *   orcamentos?: {nome?: SearchLabel}[],
 *   pedidos?: {numero?: SearchLabel, fornecedor?: string}[],
 *   comercial?: Partial<Record<"leads" | "clientes" | "propostas" | "contratos" | "parceiros", CommercialRecord[]>>,
 * }} SearchData
 */

/** @param {SearchData | null | undefined} data @param {Record<string, {label: string}>} tabs @returns {SearchEntry[]} */
export function buildGlobalSearchIndex(data, tabs) {
  if (!data) return [];
  /** @type {SearchEntry[]} */
  const index = [];
  /** @param {string} tipo @param {SearchLabel} label @param {string | undefined} sub @param {string} tabId */
  const add = (tipo, label, sub, tabId, obraId = "") => {
    if (label) index.push({ tipo, rotulo: String(label), sub: sub || "", tabId, obraId });
  };
  (data.obras || []).forEach(o => add("Obra", o.name, o.address || o.engineer, "obras", o.id));
  (data.employees || []).filter(e => e.active !== false).forEach(e => add("Funcionário", e.name, e.role, "equipe"));
  (data.terceirizados || []).forEach(t => add("Terceirizado", t.name, t.specialty, "terc"));
  (data.equipamentos || []).filter(e => e.ativo !== false).forEach(e => add("Equipamento", e.nome, e.categoria, "equip"));
  (data.orcamentos || []).forEach(o => add("Orçamento", o.nome, "", "orc"));
  (data.pedidos || []).forEach(p => add("Pedido", p.numero ? `Pedido ${p.numero}` : "Pedido", p.fornecedor, "cmp"));
  const commercial = data.comercial || {};
  (commercial.leads || []).forEach(l => add("Lead", l.nome, l.servico, "com_leads"));
  (commercial.clientes || []).forEach(c => add("Cliente", c.nome, c.documento, "com_clientes"));
  (commercial.propostas || []).forEach(p => add("Proposta", p.numero ? `Proposta ${p.numero}` : p.titulo, "", "com_propostas"));
  (commercial.contratos || []).forEach(c => add("Contrato", c.numero ? `Contrato ${c.numero}` : "Contrato", "", "com_contratos"));
  (commercial.parceiros || []).forEach(p => add("Parceiro", p.nome, "", "com_parceiros"));
  Object.entries(tabs).forEach(([id, tab]) => add("Tela", tab.label, "abrir tela", id));
  return index;
}

/** @param {SearchEntry[]} index @param {string} term @param {string[]} allowedTabs */
export function searchGlobalIndex(index, term, allowedTabs) {
  if (!term) return [];
  return index
    .filter(entry => allowedTabs.includes(entry.tabId))
    .filter(entry => entry.rotulo.toLowerCase().includes(term) || entry.sub.toLowerCase().includes(term))
    .sort((a, b) => {
      const aStart = a.rotulo.toLowerCase().startsWith(term) ? 0 : 1;
      const bStart = b.rotulo.toLowerCase().startsWith(term) ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      if ((a.tipo === "Tela") !== (b.tipo === "Tela")) return a.tipo === "Tela" ? 1 : -1;
      return a.rotulo.localeCompare(b.rotulo);
    })
    .slice(0, 20);
}
