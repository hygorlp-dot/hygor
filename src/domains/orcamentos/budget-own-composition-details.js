const ownSource = value => /^PR[ÓO]PRIA$/i.test(String(value ?? '').trim());
const number = value => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const adapted = value => /saldo|deduz|parcela|exclu[ií]d|somente|apenas/i.test(String(value ?? ''));
export function componentSnapshot(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string' || !value.trimStart().startsWith('[')) return [];
  try { const rows = JSON.parse(value); return Array.isArray(rows) ? rows.filter(Boolean) : []; } catch { return []; }
}
const key = (source, code, normalize) => `${ownSource(source) ? 'PRÓPRIA' : String(source ?? '').trim().toUpperCase()}|${normalize(code)}`;

// Version snapshots remain authoritative. Reference details explain auxiliaries;
// they never replace frozen prices or create a new financial fact.
export function ownCompositionDetails(budget, itemNumbers, normalize, relations = []) {
  const saved = new Map((budget?.composicoesProprias || []).map(c => [normalize(c.codigo), c]));
  const official = new Map();
  for (const row of relations) {
    if (row.fallbackLocal) continue;
    const id = key(row.compositionFonte || row.fonte, row.compositionCode, normalize);
    if (!official.has(id)) official.set(id, new Map());
    const base = row.baseId || `${row.dataBase || ''}|${row.uf || ''}`;
    const groups = official.get(id);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(row);
  }
  function referenceChildren(component) {
    let groups = [...(official.get(key(component.fonte, component.codigo, normalize))?.values() || [])];
    if (groups.length > 1) {
      const date = component.dataBase || budget.dataBase;
      const uf = component.uf || component.baseUf || budget.uf;
      groups = groups.filter(rows => (!date || rows[0].dataBase === date) && (!uf || rows[0].uf === uf));
    }
    if (groups.length !== 1) return { rows: [], warning: groups.length > 1 ? 'Mais de uma base analítica corresponde ao código. Confira a referência.' : 'Detalhamento auxiliar indisponível na base vinculada.' };
    return { rows: groups[0].map(row => {
      const preferred = budget.desonerado === false ? row.precoNao : row.precoDes;
      const alternate = budget.desonerado === false ? row.precoDes : row.precoNao;
      const price = row.precoDisponivel === false ? null : number(row.precoUnit) ?? (number(preferred) > 0 ? number(preferred) : number(alternate) > 0 ? number(alternate) : row.precoDisponivel === true ? number(preferred) ?? number(alternate) : null);
      return { codigo:row.itemCode, fonte:row.itemFonte || row.fonte, tipoItem:row.itemType,
        descricao:row.descricao, unidade:row.unidade, coeficiente:row.coeficiente, precoUnit:price,
        dataBase:row.dataBase, uf:row.uf, referenceOrigin:`${row.dataBase || 'Data-base não informada'} · ${row.uf || 'UF não informada'}` };
    }), warning:'' };
  }
  function expand(component, path, multiplier, ancestors) {
    const coefficient = number(component.coeficiente), price = number(component.precoUnit);
    const node = { ...component, tipoItem:String(component.tipoItem || 'INSUMO').toUpperCase(), path, coefficient, price, partial:coefficient == null || price == null ? null : coefficient * price,
      accumulated:coefficient == null || multiplier == null ? null : coefficient * multiplier, children:[], warnings:[] };
    if (coefficient == null || coefficient < 0) node.warnings.push('Coeficiente ausente ou inválido.');
    if (price == null || price < 0) node.warnings.push('Preço ausente ou inválido.');
    if (node.tipoItem !== 'COMPOSICAO') return node;
    const id = key(component.fonte, component.codigo, normalize);
    if (ancestors.includes(id)) { node.warnings.push('Referência circular: expansão interrompida.'); return node; }
    if (ancestors.length >= 20) { node.warnings.push('Limite de níveis atingido: confira o detalhamento restante.'); return node; }
    let children = componentSnapshot(component.itens).length ? componentSnapshot(component.itens) : componentSnapshot(component.composicao);
    if (!children.length && adapted(component.descricao)) {
      node.warnings.push('Parcela adaptada: o analítico integral da base não representa esta parcela. Falta a memória dos componentes mantidos e deduzidos.');
      return node;
    }
    if (!children.length && ownSource(component.fonte)) children = saved.get(normalize(component.codigo))?.itens || [];
    if (!children.length && !ownSource(component.fonte)) {
      const result = referenceChildren(component); children = result.rows;
      if (result.warning) node.warnings.push(result.warning);
    }
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

export async function loadOwnCompositionDetails(budget, itemNumbers, normalize, fetchDetails) {
  const preliminary = ownCompositionDetails(budget, itemNumbers, normalize);
  const entries = new Map();
  const visit = nodes => nodes.forEach(node => {
    if (node.tipoItem === 'COMPOSICAO' && !node.children.length && !ownSource(node.fonte) && !adapted(node.descricao) && normalize(node.codigo))
      entries.set(key(node.fonte, node.codigo, normalize), {fonte:node.fonte, codigo:normalize(node.codigo)});
    visit(node.children);
  });
  preliminary.forEach(record => visit(record.children));
  const relations = [], warnings = [];
  const requested = [...entries.values()];
  if (requested.length && !(budget.referencias || []).length) warnings.push('Sem base vinculada para consultar os auxiliares.');
  else for (let i = 0; i < requested.length; i += 100) {
    try {
      const response = await fetchDetails(budget.referencias, requested.slice(i, i + 100));
      if (!response.ok) throw new Error('Consulta indisponível');
      relations.push(...(response.components || []));
      if (response.warning) warnings.push(response.warning);
    } catch { warnings.push('Não foi possível consultar parte dos auxiliares. Confira os avisos nas fichas e tente exportar novamente.'); }
  }
  const unique = [...new Map(relations.map(row => [JSON.stringify(row), row])).values()];
  return { records:ownCompositionDetails(budget, itemNumbers, normalize, unique), warnings:[...new Set(warnings)] };
}
