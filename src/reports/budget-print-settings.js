function setupBudgetPrintSettings() {
  const table = document.querySelector(".planilha-detalhada");
  const trigger = document.querySelector("[data-budget-print-settings]");
  if (!table || !trigger) return;

  const headers = [...table.tHead.rows[0].cells];
  const labels = headers.map(header => header.dataset.budgetNeutralLabel || header.textContent.trim());
  const columns = [...table.querySelectorAll("col")];
  const description = 3;
  const defaults = {
    widths: [8, 13, 8, 36, 5, 8, 10, 12],
    visible: headers.map(() => true),
    sections: ["bdi", "calculation", "summary", "areaCost", "signatures"],
    paper: "A4", orientation: "portrait", margins: "standard", font: "10",
  };
  let committed = structuredClone(defaults);
  let draft;
  const spans = [...table.rows].map(row => {
    let start = 0;
    return [...row.cells].map(cell => {
      const entry = { cell, start, span: cell.colSpan };
      start += entry.span;
      return entry;
    });
  }).flat();
  const optionalColumns = [[1, "Código"], [2, "Fonte"], [4, "Unidade"], [5, "Quantidade"], [6, "Preço unitário"]];
  const sections = [
    ["bdi", "BDI aplicado"],
    ["calculation", "Memória de cálculo do BDI"],
    ["summary", "Resumo por etapa"],
    ["areaCost", "Custo por m²"],
    ["signatures", "Assinaturas"],
  ];
  const sectionNodes = [...document.querySelectorAll("[data-budget-section]")];
  const bdiLabels = [...document.querySelectorAll("[data-budget-neutral-label]")]
    .map(node => ({ node, original: node.textContent }));
  const pageStyle = document.head.appendChild(document.createElement("style"));
  const dialog = document.createElement("dialog");
  dialog.className = "mrc-report-controls mrc-report-dialog";
  dialog.setAttribute("aria-labelledby", "mrc-budget-print-title");
  dialog.innerHTML = `<form>
    <h2 id="mrc-budget-print-title">Configurar PDF do orçamento</h2>
    <fieldset><legend>Conteúdo</legend>
      <div class="mrc-report-dialog__checks" data-fields="sections"></div>
    </fieldset>
    <fieldset><legend>Colunas da planilha</legend>
      <div class="mrc-report-dialog__checks" data-fields="columns"></div>
      <div class="mrc-report-controls__fields">
        <label>Coluna para ajustar<select name="column"></select></label>
        <label>Largura da coluna (%)<input name="width" type="range" step="any"><output name="percent"></output></label>
      </div>
      <p>A largura escolhida redistribui o espaço entre a descrição e as demais colunas visíveis.</p>
    </fieldset>
    <fieldset><legend>Página</legend>
      <div class="mrc-report-controls__fields">
        <label>Papel<select name="paper"><option>A4</option><option>A3</option><option value="letter">Carta</option></select></label>
        <label>Orientação<select name="orientation"><option value="portrait">Retrato</option><option value="landscape">Paisagem</option></select></label>
        <label>Margens<select name="margins"><option value="standard">Padrão</option><option value="narrow">Estreitas</option><option value="wide">Largas</option></select></label>
        <label>Tamanho do texto da planilha<select name="font"><option value="9">Compacto</option><option value="10">Padrão</option><option value="11">Maior</option></select></label>
      </div>
    </fieldset>
    <div class="mrc-report-controls__actions">
      <button type="button" data-action="reset">Restaurar padrão</button>
      <button type="button" data-action="cancel">Cancelar</button>
      <button type="submit" value="preview">Aplicar à prévia</button>
      <button type="submit" value="print">Imprimir / salvar PDF</button>
    </div>
  </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  const field = name => form.elements.namedItem(name);
  function addCheckbox(group, name, label) {
    const container = document.createElement("label");
    container.className = "mrc-report-controls__check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    container.append(input, label);
    dialog.querySelector(`[data-fields="${group}"]`).append(container);
    return input;
  }
  const columnInputs = optionalColumns.map(([index, label]) => [index, addCheckbox("columns", `show-${index}`, label)]);
  const sectionInputs = sections.flatMap(([key, label]) => sectionNodes.some(node => node.dataset.budgetSection === key)
    ? [[key, addCheckbox("sections", key, label)]] : []);
  const paperFields = ["paper", "orientation", "margins", "font"];
  const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  const visibleWidths = layout => layout.widths.map((width, index) => {
    if (!layout.visible[index]) return 0;
    return index === description ? width + layout.widths.reduce((sum, value, i) => sum + (layout.visible[i] ? 0 : value), 0) : width;
  });

  function syncWidth() {
    const index = Number(field("column").value);
    const widths = visibleWidths(draft);
    const adjustable = index === description
      ? widths.reduce((sum, width, i) => sum + (i === index ? 0 : Math.max(0, width - (i === 1 ? 6 : 4))), 0)
      : Math.max(0, draft.widths[description] - 22);
    const minimum = index === description ? 22 + widths[index] - draft.widths[index] : index === 1 ? 6 : 4;
    const maximum = index === description ? Math.min(75, widths[index] + adjustable) : Math.min(index === 1 ? 20 : 30, widths[index] + adjustable);
    const slider = field("width");
    slider.min = Math.min(minimum, widths[index]);
    slider.max = Math.max(maximum, widths[index]);
    slider.value = widths[index];
    const label = `${percent.format(widths[index])}%`;
    field("percent").value = label;
    slider.setAttribute("aria-valuetext", label);
  }

  function syncColumns() {
    const select = field("column");
    const selected = select.value;
    select.replaceChildren(...labels.flatMap((label, index) => draft.visible[index] ? [new Option(label, index)] : []));
    select.value = [...select.options].some(option => option.value === selected) ? selected : draft.visible[1] ? "1" : String(description);
    syncWidth();
  }

  function syncForm() {
    columnInputs.forEach(([index, checkbox]) => { checkbox.checked = draft.visible[index]; });
    sectionInputs.forEach(([key, checkbox]) => { checkbox.checked = draft.sections.includes(key); });
    paperFields.forEach(key => { field(key).value = draft[key]; });
    syncColumns();
  }

  function apply(layout) {
    const widths = visibleWidths(layout);
    columns.forEach((col, index) => {
      col.style.display = layout.visible[index] ? "" : "none";
      col.style.width = `${widths[index]}%`;
    });
    spans.forEach(({ cell, start, span }) => {
      const visible = layout.visible.slice(start, start + span).filter(Boolean).length;
      cell.hidden = visible === 0;
      cell.colSpan = visible || 1;
    });
    sectionNodes.forEach(node => {
      node.hidden = !layout.sections.includes(node.dataset.budgetSection) ||
        (node.dataset.budgetSection === "calculation" && !layout.sections.includes("bdi"));
    });
    bdiLabels.forEach(({ node, original }) => { node.textContent = layout.sections.includes("bdi") ? original : node.dataset.budgetNeutralLabel; });
    const margins = { standard: "12mm 10mm 14mm", narrow: "8mm", wide: "18mm" };
    table.style.setProperty("--mrc-budget-table-font", `${layout.font}px`);
    pageStyle.textContent = `@page{size:${layout.paper} ${layout.orientation};margin:${margins[layout.margins]}}`;
  }

  columnInputs.forEach(([index, checkbox]) => checkbox.addEventListener("change", () => {
    draft.visible[index] = checkbox.checked;
    syncColumns();
  }));
  sectionInputs.forEach(([key, checkbox]) => checkbox.addEventListener("change", () => {
    draft.sections = checkbox.checked ? [...draft.sections, key] : draft.sections.filter(section => section !== key);
    const calculation = field("calculation");
    if (calculation) calculation.disabled = !field("bdi").checked;
  }));
  field("column").addEventListener("change", syncWidth);
  field("width").addEventListener("input", () => {
    const index = Number(field("column").value);
    const widths = visibleWidths(draft);
    const slider = field("width");
    const target = Math.max(Number(slider.min), Math.min(Number(slider.max), Math.round(Number(slider.value) * 100) / 100));
    const shift = target - widths[index];
    if (!shift) return;
    draft.widths[index] += shift;
    if (index === description) {
      const eligible = widths.map((width, i) => i !== index && draft.visible[i] ? i : -1).filter(i => i >= 0);
      const weights = eligible.map(i => shift > 0 ? Math.max(0, widths[i] - (i === 1 ? 6 : 4)) : widths[i]);
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      eligible.forEach((i, order) => { draft.widths[i] -= shift * weights[order] / total; });
    } else {
      draft.widths[description] -= shift;
    }
    syncWidth();
  });
  paperFields.forEach(key => field(key).addEventListener("change", () => { draft[key] = field(key).value; }));
  const resetDraft = (layout, column = "1") => {
    draft = structuredClone(layout);
    field("column").value = column;
    syncForm();
    const calculation = field("calculation");
    if (calculation) calculation.disabled = !field("bdi").checked;
  };
  dialog.querySelector('[data-action="reset"]').onclick = () => resetDraft(defaults);
  dialog.querySelector('[data-action="cancel"]').onclick = () => dialog.close();
  form.addEventListener("submit", event => {
    event.preventDefault();
    committed = structuredClone(draft);
    apply(committed);
    dialog.close();
    if (event.submitter?.value === "print") window.print();
  });
  trigger.onclick = () => {
    resetDraft(committed);
    dialog.showModal();
  };
  trigger.click();
}

export const budgetPrintSettingsScript = () => `(${setupBudgetPrintSettings.toString()})();`;
