import { escapeHtml } from "../../legacy/format.js";
import { componentSnapshot as readComponentSnapshot, detailTotal, ownCompositionDetails, loadOwnCompositionDetails } from "./budget-own-composition-details.js";

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
  return { compositions, components, records:ownCompositionDetails(budget, itemNumbers, normalizeCode), warnings:[] };
}

export async function loadBudgetOwnCompositionRows(budget, itemNumbers, normalizeCode) {
  const rows = budgetOwnCompositionRows(budget, itemNumbers, normalizeCode);
  return { ...rows, ...await loadOwnCompositionDetails(budget, itemNumbers, normalizeCode) };
}
const componentHeaders = ['Fonte / tipo', 'Código', 'Descrição', 'Unidade', 'Coeficiente', 'Custo unitário', 'Custo parcial'];
const componentWidths = [18, 18, 64, 10, 18, 23, 23];
const componentRow = node => [ `${node.fonte || 'Fonte não informada'} / ${node.tipoItem || 'INSUMO'}`, String(node.codigo ?? ''), node.descricao, node.unidade, node.coefficient, node.price, node.partial ];
const componentWarnings = nodes => nodes.filter(n=>n.tipoItem!=='COMPOSICAO').flatMap(n=>n.warnings.map(w=>`${n.codigo || n.descricao}: ${w}`));
const difference = (children, price) => { const total = detailTotal(children); return total == null || price == null ? null : price - total; };
const auxiliaryGroups = nodes => nodes.flatMap(node => node.tipoItem === 'COMPOSICAO' && /^PR[ÓO]PRIA$/i.test(String(node.fonte ?? '').trim()) ? [node, ...auxiliaryGroups(node.children)] : []);

export function budgetOwnCompositionSheets({ records = [], warnings = [] }) {
  const summary = [], fichas = [], components = [];
  for (const record of records) {
    summary.push([record.itemNumber,record.code,record.description,record.unit,record.quantity,record.unitCost,
      detailTotal(record.children),difference(record.children,record.unitCost),record.origin,record.note]);
    fichas.push([`Item ${record.itemNumber} · ${record.code}`,'',record.description],
      ['Unidade',record.unit,'Quantidade orçada',record.quantity],['Origem do detalhamento',record.origin],['Memória de preços','',record.note],
      componentHeaders,...record.children.map(componentRow),...componentWarnings(record.children).map(w=>['Atenção','',w]),
      ['Soma dos componentes',detailTotal(record.children)],['Custo unitário lançado sem BDI',record.unitCost],['Diferença',difference(record.children,record.unitCost)],
      ...record.warnings.map(w=>['Atenção','',w]));
    if(!record.children.length) fichas.push(['Atenção','','Composição sem componentes detalhados.']);
    for(const node of auxiliaryGroups(record.children)) {
      fichas.push([`Auxiliar ${node.path} · ${node.fonte} ${node.codigo}`,'',node.descricao],
        ['Coeficiente acumulado por unidade da composição própria',node.accumulated],
        ...node.warnings.map(w=>['Atenção','',w]),componentHeaders,...node.children.map(componentRow),...componentWarnings(node.children).map(w=>['Atenção','',w]),
        ['Soma dos componentes auxiliares',detailTotal(node.children)],['Custo unitário auxiliar utilizado',node.price],['Diferença',difference(node.children,node.price)]);
    }
    const visit = (nodes, parent) => nodes.forEach(node=>{
      components.push([record.itemNumber,record.code,node.path,parent,node.tipoItem || 'INSUMO',node.fonte,String(node.codigo ?? ''),node.descricao,node.unidade,
        node.coefficient,node.price,node.partial,node.accumulated,node.price == null || node.accumulated == null ? null : node.price*node.accumulated,node.warnings.join(' ')]);
      visit(node.children,node.path);
    });
    visit(record.children,record.code); fichas.push([]);
  }
  fichas.unshift(['Critério','','Coeficientes e custos parciais das tabelas são locais, para uma unidade do respectivo serviço. Auxiliares próprias explicam o custo do pai e não devem ser somadas novamente. Composições SINAPI e ORSE são identificadas como componentes, sem reprodução de seus analíticos.'],...warnings.map(w=>['Atenção','',w]));
  return [
    ['Composições',['Item','Código','Descrição','Unidade','Quantidade','Custo unitário sem BDI','Soma dos componentes','Diferença','Origem do detalhamento','Memória de preços'],summary,[12,20,60,10,16,23,23,20,28,55]],
    ['Fichas',['Fichas'],fichas,componentWidths],
    ['Componentes',['Item','Composição','Caminho','Pai','Tipo','Fonte','Código','Descrição','Unidade','Coeficiente local','Custo unitário','Custo parcial local','Coeficiente acumulado','Contribuição na raiz — não somar níveis','Avisos'],components,[12,20,16,20,18,18,18,64,10,20,23,23,23,30,65]],
  ];
}

// Uses the existing ExcelJS adapter rather than SheetJS-only cell styles,
// which the compatibility writer does not serialize.
export function budgetOwnCompositionWorkbook(rows, spreadsheet) {
  const sheets = budgetOwnCompositionSheets(rows);
  const workbook = spreadsheet.workbookFromTables(sheets.map(([name,headers,data,widths])=>({
    nome:name,colunas:headers.map((titulo,index)=>({titulo,largura:widths[index] || 18})),linhas:data,
  })));
  sheets.forEach(([name,,data,widths])=>{
    const sheet=workbook.getWorksheet(name);
    widths.forEach((width,index)=>{sheet.getColumn(index+1).width=width;});
    sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
    if(name==='Fichas') sheet.autoFilter=undefined;
    data.forEach((values,index)=>{
      const row=sheet.getRow(index+2);
      if(name==='Fichas'&&/^(Item |Auxiliar |Soma|Custo|Diferença|Fonte \/ tipo)/.test(String(values[0]))) row.font={bold:true};
      let lines=1;
      row.eachCell((cell,column)=>{
        cell.alignment={vertical:'top',wrapText:true,...(typeof cell.value==='number'?{horizontal:'right'}:{})};
        lines=Math.max(lines,Math.ceil(String(cell.value ?? '').length/(widths[column-1] || 18)));
        if(typeof cell.value!=='number')return;
        const c=column-1;
        const money=name==='Composições'?[5,6,7].includes(c):name==='Componentes'?[10,11,13].includes(c):c>=5||(c===1&&/^(Soma|Custo|Diferença)/.test(String(values[0])));
        cell.numFmt=money?'"R$" #,##0.00####':'#,##0.######';
      });
      row.height=Math.max(20,lines*14+6);
    });
  });
  return workbook;
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
  const cost = value => value == null ? 'Não informado' : reportText(reportNumber(value,unitCostFormat));
  const warn = messages => messages.map(message=>`<p class="detail-warning"><strong>Atenção:</strong> ${reportText(message)}</p>`).join('');
  const table = (children, label) => children.length ? `<div class="detail-table" tabindex="0" role="region" aria-label="Tabela de ${reportText(label)}"><table aria-label="${reportText(label)}">
    <colgroup><col style="width:13%"><col style="width:10%"><col style="width:33%"><col style="width:6%"><col style="width:10%"><col style="width:14%"><col style="width:14%"></colgroup>
    <thead><tr><th colspan="7">${reportText(label)} — componentes por unidade</th></tr><tr>${componentHeaders.map((h,c)=>`<th scope="col"${c>=4?' class="num" data-align="end"':''}>${h}</th>`).join('')}</tr></thead>
    <tbody>${children.map(node=>`<tr>${componentRow(node).map((value,c)=>`<td${c>=4?' class="num" data-align="end"':''}>${c>=5?cost(value):c===4?(value==null?'Não informado':reportText(reportNumber(value,quantityFormat))):reportText(value)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>${warn(componentWarnings(children))}` : '<p>Sem componentes detalhados. Confira a memória desta composição.</p>';
  const totals = (children, price) => `<dl class="detail-totals"><div><dt>Soma dos componentes</dt><dd>${cost(detailTotal(children))}</dd></div><div><dt>Custo unitário utilizado sem BDI</dt><dd>${cost(price)}</dd></div><div><dt>Diferença</dt><dd>${cost(difference(children,price))}</dd></div></dl>${difference(children,price)!=null&&Math.round(Math.abs(difference(children,price))*100)>0?'<p class="detail-warning">A soma dos componentes difere do custo utilizado. Confira a memória de preços; o valor lançado foi preservado.</p>':''}`;
  const tables = (rows.records || []).map(record=>`<section class="composition-sheet">
    <h2>Item ${reportText(record.itemNumber)} · ${reportText(record.code)} — ${reportText(record.description)}</h2>
    <p>Unidade: ${reportText(record.unit)} · Quantidade orçada: ${reportText(reportNumber(record.quantity,quantityFormat))} · Custo unitário sem BDI: ${cost(record.unitCost)}</p>
    <p>Origem do detalhamento: ${reportText(record.origin)}</p>${record.note?`<p><strong>Memória de preços:</strong> ${reportText(record.note)}</p>`:''}${warn(record.warnings)}
    ${table(record.children,record.code)}${totals(record.children,record.unitCost)}
    ${auxiliaryGroups(record.children).map(node=>`<section class="auxiliary-sheet"><h3>Auxiliar ${reportText(node.path)} · ${reportText(node.fonte)} ${reportText(node.codigo)} — ${reportText(node.descricao)}</h3>
      <p>Coeficiente acumulado por unidade de ${reportText(record.code)}: ${reportText(reportNumber(node.accumulated,quantityFormat))}. ${node.referenceOrigin?`Referência consultada: ${reportText(node.referenceOrigin)}.`:''}</p>
      ${warn(node.warnings)}${table(node.children,`${record.code} / auxiliar ${node.path} / ${node.codigo}`)}${totals(node.children,node.price)}</section>`).join('')}
    </section>`).join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${reportText(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm 14mm; }
  body { margin: 0; }
  h1, h2, h3 { break-after: avoid; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  th, td { padding: 4pt; border-bottom: 1px solid; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .composition-sheet { margin-block: 24pt; }
  .auxiliary-sheet { margin-block: 18pt; }
  .detail-totals { margin-left: auto; max-width: 30em; break-inside: avoid; }
  .detail-totals div { display: flex; justify-content: space-between; gap: 12pt; }
  .detail-totals dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .detail-warning { font-weight: bold; }
  @media screen { body { padding: 16px; } .detail-table { overflow-x: auto; } table { min-width: 760px; } }
  @media print {
    .composition-sheet { margin-block: 12pt; }
    .composition-sheet + .composition-sheet { break-before: page; }
    .composition-sheet p { margin-block: 5pt; }
    .auxiliary-sheet { margin-block: 10pt; break-inside: avoid; }
    .detail-totals { break-before: avoid; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td { overflow-wrap: anywhere; }
  }
</style></head><body>
<button type="button" onclick="window.print()">Imprimir / salvar PDF</button>
<h1>Composições próprias</h1>
<p>${reportText(name)} · V${reportText(version)}</p>
<p>${reportText(itemCountLabel)}</p>
<p>Coeficientes e custos parciais são locais: cada tabela corresponde a uma unidade do serviço identificado. Somente auxiliares próprias são detalhadas, com seus coeficientes acumulados. Composições SINAPI e ORSE são identificadas como componentes; consulte seus analíticos diretamente na fonte. Não some novamente os auxiliares ao custo do pai. Preços das memórias são preservados.</p>
${warn(rows.warnings || [])}
${tables}
</body></html>`;
}
