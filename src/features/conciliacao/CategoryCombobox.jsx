import { useEffect, useId, useRef, useState } from "react";
import { normalizeCategorySearch } from "../../domains/conciliacao/categories.js";
import "./category-combobox.css";

// Digitar pesquisa o catálogo existente; somente escolher uma opção altera
// a classificação financeira. Texto livre nunca vira uma categoria nova.
export default function CategoryCombobox({
  label = "Categoria", options = [], value = "", onChange, disabled = false,
  placeholder = "Digite nome, código ou grupo", clearable = false,
  emptyLabel = "Todas as categorias", required = false,
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const optionsRef = useRef(null);
  const selected = options.find(option => option.id === value);
  const terms = normalizeCategorySearch(query).split(/\s+/).filter(Boolean);
  const filtered = options.filter(option => {
    const text = normalizeCategorySearch(`${option.id} ${option.label} ${option.groupLabel || ""} ${option.group || ""} ${option.description || ""}`);
    return terms.every(term => text.includes(term));
  });
  const activeIndex = Math.min(active, Math.max(0, filtered.length - 1));
  useEffect(() => {
    if (open) optionsRef.current?.children[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, query]);
  const choose = option => {
    onChange(option.id);
    setOpen(false);
    setQuery("");
  };
  const showOptions = () => { setOpen(true); setQuery(""); setActive(0); };
  const onKeyDown = event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { showOptions(); return; }
      setActive(index => Math.max(0, Math.min(filtered.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (filtered[activeIndex]) choose(filtered[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : Math.max(0, filtered.length - 1));
    }
  };
  return <div className="reconciliation-category" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label htmlFor={`${id}-input`}>{label}{required ? " *" : ""}</label>
    <div className="reconciliation-category__control">
      <input id={`${id}-input`} role="combobox" aria-autocomplete="list" aria-expanded={open}
        aria-controls={`${id}-options`} aria-activedescendant={open && filtered.length ? `${id}-option-${activeIndex}` : undefined}
        aria-required={required} disabled={disabled} autoComplete="off"
        value={open ? query : (selected?.label || "")} placeholder={value ? placeholder : (clearable ? emptyLabel : placeholder)}
        onFocus={showOptions} onClick={() => { if (!open) showOptions(); }}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }} onKeyDown={onKeyDown}/>
      {clearable && value && <button type="button" disabled={disabled} aria-label={`Limpar ${label.toLowerCase()}`}
        onClick={() => { onChange(""); setOpen(false); setQuery(""); }}>×</button>}
    </div>
    {open && <div className="reconciliation-category__popup">
      <ul ref={optionsRef} id={`${id}-options`} role="listbox" aria-label={label}>
        {filtered.map((option, index) => <li key={option.id} id={`${id}-option-${index}`} role="option"
          aria-selected={value === option.id} data-active={index === activeIndex}
          onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => choose(option)}>
          <strong>{option.label}</strong>
          {option.groupLabel && <small>{option.groupLabel}</small>}
        </li>)}
      </ul>
      {!filtered.length && <p role="status">Nenhuma categoria encontrada. Ajuste a busca.</p>}
    </div>}
  </div>;
}
