// Executado no documento independente de impressão, depois das fontes.
// Só modifica apresentação: nenhum conteúdo de célula é reescrito.
export function setupAdjustableTables() {
  const storageKey = "mrc-report-table-layout-v1";
  const root = document.body;
  const context = document.createElement("canvas").getContext("2d");
  const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const tables = [...document.querySelectorAll("table")].flatMap((table, index) => {
    const headers = [...(table.tHead?.rows[0]?.cells || [])];
    if (headers.length < 2 || table.tHead.rows.length !== 1 || headers.some(h => h.colSpan !== 1)) return [];
    const cells = [...table.tBodies].flatMap(body => [...body.rows]).filter(row => row.cells.length === headers.length);
    const footerCells = headers.map(() => []);
    for (const row of table.tFoot?.rows || []) {
      let column = 0;
      for (const cell of row.cells) {
        if (cell.colSpan === 1 && footerCells[column]) footerCells[column].push(cell);
        column += cell.colSpan;
      }
    }
    const footerWidth = cells => Math.max(0, ...cells.map(cell => {
      context.save(); context.font = getComputedStyle(cell).font;
      const width = context.measureText(cell.textContent.trim()).width + 16;
      context.restore(); return width;
    }));
    const kind = headers.map(h => {
      const name = normalize(h.textContent);
      if (/funcionario|nome/.test(name)) return "name";
      if (/cargo|funcao/.test(name)) return "role";
      if (/obra|centro/.test(name)) return "work";
      return "value";
    });
    context.font = getComputedStyle(cells[0]?.cells[0] || headers[0]).font;
    const measure = text => context.measureText(text.trim()).width;
    const widths = headers.map((header, i) => {
      const content = cells.map(row => row.cells[i].textContent.trim());
      const measured = Math.max(Math.max(0, ...content.map(measure)) + 12, footerWidth(footerCells[i]));
      if (kind[i] === "name") return Math.max(190, Math.min(320, measured));
      if (kind[i] === "role") return Math.max(100, Math.min(170, measured));
      if (kind[i] === "work") return Math.max(90, Math.min(160, measured));
      const heading = Math.max(...header.textContent.trim().split(/\s+/).map(measure)) + 10;
      return Math.max(30, heading, Math.min(180, measured));
    });
    const total = widths.reduce((a, b) => a + b, 0);
    const spare = Math.max(0, table.getBoundingClientRect().width - total);
    const weights = kind.map(k => ({ name: 3, role: 1.5, work: 1.5 }[k] || 0));
    const weight = weights.reduce((a, b) => a + b, 0);
    const expanded = widths.map((w, i) => w + (weight ? spare * weights[i] / weight : spare / widths.length));
    const sum = expanded.reduce((a, b) => a + b, 0);
    const automatic = expanded.map(w => w / sum * 100);
    const group = document.createElement("colgroup");
    headers.forEach(() => group.append(document.createElement("col")));
    table.querySelectorAll("colgroup").forEach(g => g.remove());
    table.prepend(group);
    table.dataset.mrcAdjustable = "true";
    return [{ table, group, headers, footerCells, footerWidth, intrinsicWidth:sum, automatic, widths: [...automatic], key: headers.map(h => h.textContent.trim()).join("|"), label: table.dataset.reportTableName || `Tabela ${index + 1}` }];
  });
  if (!tables.length) return;
  const panel = document.createElement("aside");
  panel.className = "mrc-report-controls";
  panel.setAttribute("aria-label", "Ajustes de impressão");
  panel.innerHTML = `<h2>Ajustar PDF</h2><p>As larguras já foram distribuídas pelo conteúdo. Ajuste a prévia e depois imprima.</p>
    <div class="mrc-report-controls__fields">
      <label>Tabela<select id="mrc-table"></select></label>
      <label>Coluna<select id="mrc-column"></select></label>
      <label>Largura da coluna (%)<input id="mrc-width" type="range" min="2" max="50" step="0.5"><output id="mrc-width-value"></output></label>
      <label>Tamanho do texto (px)<input id="mrc-font" type="range" min="9" max="13" value="10" step="0.5"><output id="mrc-font-value">10</output></label>
      <label>Espaçamento das linhas (px)<input id="mrc-padding" type="range" min="1" max="8" value="2" step="1"><output id="mrc-padding-value">2</output></label>
    </div><label class="mrc-report-controls__check"><input id="mrc-annex" type="checkbox">Iniciar cada anexo em nova página</label>
    <div class="mrc-report-controls__actions"><button type="button" id="mrc-print">Imprimir / Salvar PDF</button><button type="button" id="mrc-save">Salvar como padrão</button><button type="button" id="mrc-reset">Restaurar automático</button></div><p id="mrc-layout-status" role="status"></p>`;
  root.prepend(panel);
  const control = id => panel.querySelector(`#mrc-${id}`);
  const selected = () => tables[Number(control("table").value) || 0];
  const apply = table => {
    const available = Math.max(table.intrinsicWidth, table.table.getBoundingClientRect().width);
    const minimum = table.footerCells.map(cells => table.footerWidth(cells) / available * 100);
    const floor = minimum.reduce((sum,width) => sum + width, 0);
    const surplus = table.widths.map((width,i) => Math.max(0,width - minimum[i]));
    const sum = surplus.reduce((sum,width) => sum + width, 0);
    if (floor < 100 && sum > 0) table.widths = minimum.map((width,i) => width + surplus[i] * (100 - floor) / sum);
    [...table.group.children].forEach((col, i) => { col.style.width = `${table.widths[i].toFixed(6)}%`; });
  };
  const spacing = () => {
    root.style.setProperty("--mrc-table-font", `${control("font").value}px`);
    root.style.setProperty("--mrc-table-padding", `${control("padding").value}px`);
    root.dataset.annexNewPage = String(control("annex").checked);
    control("font-value").textContent = control("font").value;
    control("padding-value").textContent = control("padding").value;
    tables.forEach(apply);
    if(control("column").options.length)showWidth();
  };
  const showWidth = () => {
    const value = selected().widths[Number(control("column").value) || 0];
    control("width").value = value;
    control("width-value").textContent = `${value.toFixed(1)}%`;
  };
  const showColumns = () => {
    control("column").replaceChildren(...selected().headers.map((h, i) => new Option(h.textContent, String(i))));
    showWidth();
  };
  tables.forEach((table, i) => control("table").add(new Option(table.label, String(i))));
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved) {
      if (Number(saved.font) >= 9 && Number(saved.font) <= 13) control("font").value = saved.font;
      if (Number(saved.padding) >= 1 && Number(saved.padding) <= 8) control("padding").value = saved.padding;
      control("annex").checked = saved.annex === true;
      tables.forEach(table => {
        const widths = saved.tables?.[table.key];
        if (Array.isArray(widths) && widths.length === table.widths.length && widths.every(w => Number.isFinite(w) && w > 0)) {
          const sum = widths.reduce((a, b) => a + b, 0);
          table.widths = widths.map(w => w / sum * 100);
        }
      });
    }
  } catch { /* Prévia também funciona quando o armazenamento está indisponível. */ }
  tables.forEach(apply); spacing(); showColumns();
  control("table").onchange = showColumns;
  control("column").onchange = showWidth;
  control("width").oninput = () => {
    const table = selected(), index = Number(control("column").value), value = Number(control("width").value);
    const remaining = 100 - table.widths[index];
    table.widths = table.widths.map((w, i) => i === index ? value : w * (100 - value) / remaining);
    apply(table); showWidth();
  };
  control("font").oninput = spacing;
  control("padding").oninput = spacing;
  control("annex").onchange = spacing;
  control("print").onclick = () => window.print();
  control("save").onclick = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ font: Number(control("font").value), padding: Number(control("padding").value), annex: control("annex").checked, tables: Object.fromEntries(tables.map(t => [t.key, t.widths])) }));
      control("layout-status").textContent = "Padrão salvo neste navegador.";
    } catch { control("layout-status").textContent = "Não foi possível salvar. Os ajustes continuam válidos nesta prévia."; }
  };
  control("reset").onclick = () => {
    tables.forEach(table => { table.widths = [...table.automatic]; apply(table); });
    control("font").value = "10"; control("padding").value = "2"; control("annex").checked = false;
    spacing(); showWidth(); control("layout-status").textContent = "Distribuição automática restaurada. Salve para usar como padrão.";
  };
}

export const adjustableTablesScript = () => `(${setupAdjustableTables.toString()})();`;
