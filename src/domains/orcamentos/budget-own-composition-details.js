const ownSource = value => /^PR[ÓO]PRIA$/i.test(String(value ?? '').trim());
const number = value => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const adapted = value => /saldo|deduz|parcela|exclu[ií]d|somente|apenas/i.test(String(value ?? ''));
export function componentSnapshot(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string' || !value.trimStart().startsWith('[')) return [];
  try { const rows = JSON.parse(value); return Array.isArray(rows) ? rows.filter(Boolean) : []; } catch { return []; }
}
const key = (source, code, normalize) => `${ownSource(source) ? 'PRÓPRIA' : String(source ?? '').trim().toUpperCase()}|${normalize(code)}`;

// Only saved own compositions are expanded. Official compositions remain
// referenced components; export never replaces frozen prices or creates costs.
export function ownCompositionDetails(budget, itemNumbers, normalize) {
  const saved = new Map((budget?.composicoesProprias || []).map(c => [normalize(c.codigo), c]));
  function expand(component, path, multiplier, ancestors) {
    const coefficient = number(component.coeficiente), price = number(component.precoUnit);
    const node = { ...component, tipoItem:String(component.tipoItem || 'INSUMO').toUpperCase(), path, coefficient, price, partial:coefficient == null || price == null ? null : coefficient * price,
      accumulated:coefficient == null || multiplier == null ? null : coefficient * multiplier, children:[], warnings:[] };
    if (coefficient == null || coefficient < 0) node.warnings.push('Coeficiente ausente ou inválido.');
    if (price == null || price < 0) node.warnings.push('Preço ausente ou inválido.');
    if (node.tipoItem !== 'COMPOSICAO') return node;
    if (!ownSource(component.fonte)) {
      if (!componentSnapshot(component.itens).length && !componentSnapshot(component.composicao).length && adapted(component.descricao))
        node.warnings.push('Parcela adaptada: falta a memória dos componentes mantidos e deduzidos.');
      return node;
    }
    const id = key(component.fonte, component.codigo, normalize);
    if (ancestors.includes(id)) { node.warnings.push('Referência circular: expansão interrompida.'); return node; }
    if (ancestors.length >= 20) { node.warnings.push('Limite de níveis atingido: confira o detalhamento restante.'); return node; }
    let children = componentSnapshot(component.itens).length ? componentSnapshot(component.itens) : componentSnapshot(component.composicao);
    if (!children.length && adapted(component.descricao)) {
      node.warnings.push('Parcela adaptada: o analítico integral da base não representa esta parcela. Falta a memória dos componentes mantidos e deduzidos.');
      return node;
    }
    if (!children.length && ownSource(component.fonte)) children = saved.get(normalize(component.codigo))?.itens || [];
    if (!children.length && !node.warnings.length) node.warnings.push('Composição auxiliar sem componentes gravados.');
    node.children = children.map((c, index) => expand(c, `${path}.${index + 1}`, node.accumulated, [...ancestors, id]));
    return node;
  }
  return (budget?.itens || []).filter(i => i.tipo !== 'titulo' && ownSource(i.fonte)).map(item => {
    const snapshot = componentSnapshot(item.composicao);
    const detail = snapshot.length ? snapshot : saved.get(normalize(item.codigo))?.itens || [];
    const children = detail.map((c, index) => expand(c, String(index + 1), 1, [key('PRÓPRIA', item.codigo, normalize)]));
    return { itemId:item.id, itemNumber:itemNumbers.get(item.id) || '', code:String(item.codigo ?? ''), description:item.descricao,
      unit:item.unidade, quantity:number(item.quantidade), unitCost:number(item.precoUnit), children,
      origin:snapshot.length ? 'Memória do item' : detail.length ? 'Composição da versão' : 'Sem componentes detalhados',
      note:!snapshot.length && typeof item.composicao === 'string' && !item.composicao.trimStart().startsWith('[') ? item.composicao.trim() : '',
      warnings:typeof item.composicao === 'string' && item.composicao.trimStart().startsWith('[') && !snapshot.length ? ['Memória de componentes vazia ou inválida; confira a origem do detalhamento.'] : [] };
  });
}

export function detailTotal(children) {
  return children.length && children.every(c => c.partial != null) ? children.reduce((sum, c) => sum + c.partial, 0) : null;
}

export async function loadOwnCompositionDetails(budget, itemNumbers, normalize) {
  return { records:ownCompositionDetails(budget, itemNumbers, normalize), warnings:[] };
}
