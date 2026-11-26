function setupBudgetPrintSettings() {
  const table = document.querySelector(".planilha-detalhada");
  const trigger = document.querySelector("[data-budget-print-settings]");
  if (!table || !trigger) return;
  const headers = [...table.tHead.rows[0].cells];
  const columns = [...table.querySelectorAll("col")];
  const description = 3;
  const initialWidths = columns.map(col => parseFloat(col.style.width));
  const sectionNodes = [...document.querySelectorAll("[data-budget-section]")];
  const bdiLabels = [...document.querySelectorAll("[data-budget-neutral-label]")].map(node => [node,node.textContent]);
  const pageStyle = document.head.appendChild(document.createElement("style"));
  const dialog = document.createElement("dialog");
  dialog.className = "mrc-report-controls mrc-report-dialog";
  dialog.setAttribute("aria-labelledby", "mrc-print-title");
  const fieldsHtml = [
    ["paper","Papel",[["A4"],["A3"],["letter","Carta"]]],
    ["orientation","Orientação",[["portrait","Retrato"],["landscape","Paisagem"]]],
    ["margin","Margens",[["12mm 10mm 14mm","Padrão"],["8mm","Estreitas"],["18mm","Largas"]]],
    ["font","Tamanho do texto da planilha",[["10","Padrão"],["9","Compacto"],["11","Maior"]]],
  ].map(([id,title,options])=>`<label>${title}<select name="${id}">${options.map(([value,label=value])=>`<option value="${value}">${label}</option>`).join("")}</select></label>`).join("");
  const checkbox = ([id, title]) => `<label class="mrc-report-controls__check"><input type="checkbox" name="${id}" checked>${title}</label>`;
  const sections = [["bdi","BDI aplicado"],["calculation","Memória de cálculo do BDI"],["summary","Resumo por etapa"],["areaCost","Custo por m²"],["signatures","Assinaturas"]]
    .filter(([id]) => sectionNodes.some(node => node.dataset.budgetSection === id));
  const optional = [[1,"Código"],[2,"Fonte"],[4,"Unidade"],[5,"Quantidade"],[6,"Preço unitário"]];
  dialog.innerHTML = `<form><h2 id="mrc-print-title">Configurar PDF do orçamento</h2>
    <fieldset><legend>Conteúdo</legend><div class="mrc-report-dialog__checks">${sections.map(checkbox).join("")}</div></fieldset>
    <fieldset><legend>Colunas da planilha</legend><div class="mrc-report-dialog__checks">${optional.map(checkbox).join("")}</div>
    <div class="mrc-report-controls__fields"><label>Coluna para ajustar<select name="column"></select></label>
    <label>Largura da coluna (%)<input type="range" step="any" name="width"><output></output></label></div></fieldset>
    <fieldset><legend>Página</legend><div class="mrc-report-controls__fields">
    ${fieldsHtml}
    </div></fieldset><div class="mrc-report-controls__actions">
    <button type="reset">Restaurar padrão</button><button type="button">Cancelar</button>
    <button type="submit">Aplicar à prévia</button><button type="submit" value="print">Imprimir / salvar PDF</button></div></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  const field = name => form.elements.namedItem(name);
  const select = field("column");
  const slider = field("width");
  const output = form.querySelector("output");
  const fields = [...form.querySelectorAll("input[type=checkbox],select")].filter(el => el !== select);
  const savedValues = () => fields.map(el => el.type === "checkbox" ? el.checked : el.value);
  const initialValues = savedValues();
  let saved = initialValues;
  const restoreValues = values => fields.forEach((el, i) => {
    if (el.type === "checkbox") el.checked = values[i];
    else el.value = values[i];
  });
  let widths = initialWidths;
  let draft;
  const shown = index => field(String(index))?.checked !== false;
  const minimumWidth = index => index === 1 ? 6 : 4;
  const adjustableColumns = () => draft.map((_, i) => i).filter(i => i !== description && shown(i));
  const effective = index => draft[index] + (index === description ? draft.reduce((sum, width, i) => sum + (shown(i) ? 0 : width), 0) : 0);
  const renderSlider = () => {
    const index = Number(select.value);
    const width = effective(index);
    slider.min = index === description ? 22 + width - draft[index] : minimumWidth(index);
    slider.max = index === description ? Math.min(75, 100 - adjustableColumns().reduce((sum, i) => sum + minimumWidth(i), 0)) : Math.max(width, Math.min(index === 1 ? 20 : 30, width + draft[description] - 22));
    slider.value = width;
    output.value = Number(width.toFixed(2)).toLocaleString("pt-BR") + "%";
    slider.setAttribute("aria-valuetext", output.value);
  };
  const render = (preferred = select.value) => {
    select.replaceChildren(...headers.flatMap((h, i) => shown(i) ? [new Option(h.dataset.budgetNeutralLabel || h.textContent, i)] : []));
    select.value = shown(Number(preferred)) && preferred ? preferred : shown(1) ? "1" : String(description);
    if (field("calculation")) field("calculation").disabled = !field("bdi").checked;
    renderSlider();
  };
  const grid = [...table.rows].flatMap(row => {
    let start = 0;
    return [...row.cells].map(cell => {
      const entry=[cell,start,cell.colSpan];
      start+=cell.colSpan;
      return entry;
    });
  });
  form.onchange = event => {
    if (event.target === select || event.target.type === "checkbox") render();
  };
  slider.oninput = () => {
    const index = Number(select.value);
    const shift = Number(slider.value) - effective(index);
    draft[index] += shift;
    if (index === description) {
      const other = adjustableColumns();
      const sum = other.reduce((total, i) => total + draft[i] - minimumWidth(i), 0);
      other.forEach(i => { draft[i] -= shift * (sum ? (draft[i] - minimumWidth(i)) / sum : 1 / other.length); });
    } else {
      draft[description] -= shift;
    }
    renderSlider();
  };
  form.onreset = event => {
    event.preventDefault();
    restoreValues(initialValues);
    draft = [...initialWidths];
    render("1");
  };
  form.querySelector('button[type="button"]').onclick = () => dialog.close();
  form.onsubmit = event => {
    event.preventDefault();
    saved = savedValues();
    widths = [...draft];
    columns.forEach((col, i) => {
      col.style.display = shown(i) ? "" : "none";
      col.style.width = shown(i) ? `${effective(i)}%` : "0%";
    });
    grid.forEach(([cell,start,span]) => {
      const count=columns.slice(start,start+span).filter((_,i)=>shown(start+i)).length;
      cell.hidden = count === 0;
      cell.colSpan = count || 1;
    });
    sectionNodes.forEach(node => {
      const toggle = field(node.dataset.budgetSection);
      node.hidden = !toggle.checked || toggle.disabled;
    });
    bdiLabels.forEach(([node,label]) => { node.textContent = field("bdi").checked ? label : node.dataset.budgetNeutralLabel; });
    table.style.setProperty("--mrc-budget-table-font", field("font").value + "px");
    pageStyle.textContent = `@page{size:${field("paper").value} ${field("orientation").value};margin:${field("margin").value}}`;
    dialog.close();
    if (event.submitter?.value === "print") window.print();
  };
  trigger.onclick = () => {
    restoreValues(saved);
    draft = [...widths];
    render("1");
    dialog.showModal();
  };
  trigger.click();
}
export const budgetPrintSettingsScript = () => `(${setupBudgetPrintSettings.toString()})();`;
