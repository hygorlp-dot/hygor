function readComponentSnapshot(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "string" || !value.trimStart().startsWith("[")) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function budgetOwnCompositionRows(budget, itemNumbers, normalizeCode) {
  const savedByCode = new Map((budget?.composicoesProprias || [])
    .filter(definition => normalizeCode(definition.codigo))
    .map(definition => [normalizeCode(definition.codigo), definition]));
  const compositions = [];
  const components = [];
  for (const item of budget?.itens || []) {
    if (item.tipo === "titulo" || !/^PR[ÓO]PRIA$/i.test(String(item.fonte ?? "").trim())) continue;
    const itemNumber = itemNumbers.get(item.id) ?? "";
    const code = String(item.codigo ?? "");
    const snapshot = readComponentSnapshot(item.composicao);
    const note = !snapshot.length && typeof item.composicao === "string" ? item.composicao.trim() : "";
    const detail = snapshot.length ? snapshot : savedByCode.get(normalizeCode(code))?.itens || [];
    compositions.push([
      itemNumber, code, item.descricao, item.unidade, item.quantidade, item.precoUnit,
      snapshot.length ? "Memória do item" : detail.length ? "Composição da versão" : "Sem componentes detalhados",
      note,
    ]);
    for (const component of detail) {
      components.push([
        itemNumber, code, component.tipoItem || "INSUMO", component.fonte, String(component.codigo ?? ""),
        component.descricao, component.unidade, component.coeficiente, component.precoUnit,
      ]);
    }
  }
  return { compositions, components };
}
