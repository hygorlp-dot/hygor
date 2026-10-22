// Envio só do que mudou numa seção do blob (lista de registros com id).
//
// Antes, alterar um valor de um orçamento mandava TODOS os orçamentos de
// todas as obras, duas vezes (versão nova + versão de referência): ~0,8 MB
// por clique. Agora a tela manda só os registros alterados, a versão original
// deles e os ids removidos; o servidor reconstrói as listas completas a partir
// do estado atual ANTES de qualquer validação, então permissões, imutabilidade
// e detecção de conflito continuam vendo exatamente o mesmo de antes.
//
// Fica de fora (volta ao envio completo) qualquer seção que não seja lista de
// objetos com id único ou em que a ordem dos registros mudou.

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const listaComIds = lista => {
  if (!Array.isArray(lista)) return null;
  const ids = new Map();
  for (const item of lista) {
    if (!item || typeof item !== "object" || Array.isArray(item) || item.id == null) return null;
    const id = String(item.id);
    if (ids.has(id)) return null;
    ids.set(id, item);
  }
  return ids;
};

export const buildSectionDelta = (base, proximo) => {
  const antes = listaComIds(base), depois = listaComIds(proximo);
  if (!antes || !depois) return null;
  const ordemAntes = [...antes.keys()].filter(id => depois.has(id));
  const ordemDepois = [...depois.keys()].filter(id => antes.has(id));
  if (!igual(ordemAntes, ordemDepois)) return null;
  const changed = [], original = [], removed = [];
  for (const [id, item] of depois) {
    const anterior = antes.get(id);
    if (!anterior) changed.push(item);
    else if (!igual(anterior, item)) { changed.push(item); original.push(anterior); }
  }
  for (const [id, item] of antes) if (!depois.has(id)) { removed.push(id); original.push(item); }
  return { changed, original, removed };
};

const deltaValido = delta => delta && typeof delta === "object"
  && Array.isArray(delta.changed) && Array.isArray(delta.original) && Array.isArray(delta.removed)
  && [...delta.changed, ...delta.original].every(item => item && typeof item === "object" && item.id != null);

// Reconstrói { incoming, base } completos sobre `atual` (estado do servidor).
// Registros que o cliente não tocou entram iguais nos dois lados, e a
// mesclagem de três vias os resolve para o valor atual do servidor.
export const expandSectionDelta = (delta, atual) => {
  if (!deltaValido(delta)) return null;
  const corrente = Array.isArray(atual) ? atual.filter(item => item?.id != null) : [];
  const novos = new Map(delta.changed.map(item => [String(item.id), item]));
  const originais = new Map(delta.original.map(item => [String(item.id), item]));
  const removidos = new Set(delta.removed.map(String));
  const idsCorrentes = new Set(corrente.map(item => String(item.id)));
  const base = corrente.map(item => originais.get(String(item.id)) || item);
  originais.forEach((item, id) => { if (!idsCorrentes.has(id)) base.push(item); });
  const incoming = corrente
    .filter(item => !removidos.has(String(item.id)))
    .map(item => novos.get(String(item.id)) || item);
  novos.forEach((item, id) => { if (!idsCorrentes.has(id)) incoming.push(item); });
  return { incoming, base };
};

// Auditoria guarda só os registros que mudaram (antes: alterados e removidos;
// depois: alterados e incluídos). Seções que não são listas com id seguem
// inteiras. Remoções continuam detectáveis comparando os ids dos dois lados.
export const compactAuditSnapshots = (before = {}, after = {}) => {
  const antes = {}, depois = {};
  for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) {
    const delta = buildSectionDelta(before?.[key], after?.[key]);
    if (!delta) { antes[key] = before?.[key]; depois[key] = after?.[key]; continue; }
    antes[key] = delta.original;
    depois[key] = delta.changed;
  }
  return { before: antes, after: depois };
};
