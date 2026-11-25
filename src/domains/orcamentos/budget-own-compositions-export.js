import { escapeHtml } from "../../legacy/format.js";

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
const compositionHeaders = ["Item", "Código", "Descrição", "Unidade", "Quantidade", "Custo unitário sem BDI", "Origem do detalhamento", "Memória de preços"];
const componentHeaders = ["Item", "Código da composição", "Tipo", "Fonte", "Código do componente", "Descrição", "Unidade", "Coeficiente", "Custo unitário do componente"];


export function budgetOwnCompositionSheets({ compositions, components }) {
  return [
    ["Composições", compositionHeaders, compositions, [12, 27, 55, 10, 14, 23, 28, 50]],
    ["Componentes", componentHeaders, components, [12, 27, 16, 13, 24, 55, 10, 14, 29]],
  ];
}

const quantityFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });
const unitCostFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 6 });
const reportText = value => escapeHtml(String(value ?? ""));
const reportNumber = (value, formatter) => {
  if (value === "" || value == null) return "";
  const number = Number(value);
  return Number.isFinite(number) ? formatter.format(number) : value;
};

export function budgetOwnCompositionPrintHtml({ name, version, itemCountLabel, rows }) {
  const title = `Composições próprias — ${name} · V${version}`;
  const tables = budgetOwnCompositionSheets(rows).map(([heading, headers, data, widths]) => {
    if (!data.length) return "<h2>Componentes</h2><p>Nenhum componente detalhado nesta versão.</p>";
    const quantityColumn = heading === "Composições" ? 4 : 7;
    const costColumn = quantityColumn + 1;
    const totalWidth = widths.reduce((total, width) => total + width, 0);
    const cellClass = column => column === quantityColumn || column === costColumn ? ' class="num"' : "";
    return `<h2>${heading}</h2>
<table aria-label="${heading}">
  <colgroup>${widths.map(width => `<col style="width:${100 * width / totalWidth}%">`).join("")}</colgroup>
  <thead><tr>${headers.map((header, column) => `<th scope="col"${cellClass(column)}>${header}</th>`).join("")}</tr></thead>
  <tbody>${data.map(row => `<tr>${row.map((value, column) => {
    const formatter = column === quantityColumn ? quantityFormat : column === costColumn ? unitCostFormat : null;
    return `<td${cellClass(column)}>${reportText(formatter ? reportNumber(value, formatter) : value)}</td>`;
  }).join("")}</tr>`).join("")}</tbody>
</table>`;
  }).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${reportText(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm 14mm; }
  body { margin: 0; }
  h1, h2 { break-after: avoid; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  th, td { padding: 4pt; border-bottom: 1px solid; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  @media screen { body { padding: 16px; } }
  @media print { th, td { overflow-wrap: anywhere; } }
</style></head><body>
<button type="button" onclick="window.print()">Imprimir / salvar PDF</button>
<h1>Composições próprias</h1>
<p>${reportText(name)} · V${reportText(version)}</p>
<p>${reportText(itemCountLabel)}</p>
${tables}
</body></html>`;
}
