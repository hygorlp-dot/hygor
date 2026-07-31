import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../design-system/primitives/Button.jsx";
import "./styles.css";

export function MobileFilterSheet({ open, onOpenChange, title = "Filtrar registros", children, onApply, onClear, onCancel, activeCount = 0 }) {
  const sheetRef = useRef(null);
  const titleId = useId();
  const close = () => { onCancel?.(); onOpenChange?.(false); };
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => sheetRef.current?.focus(), 0);
    return () => { window.removeEventListener("keydown", onKeyDown); window.clearTimeout(timer); };
  });
  if (!open) return null;
  return createPortal(<div className="arcd-mobile-filter-sheet__backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={sheetRef} className="arcd-mobile-filter-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="arcd-mobile-filter-sheet__header"><div><h2 id={titleId}>{title}</h2>{activeCount > 0 && <p>{activeCount} filtro{activeCount === 1 ? "" : "s"} ativo{activeCount === 1 ? "" : "s"}</p>}</div><Button variant="ghost" size="icon" aria-label="Fechar filtros" onClick={close}>×</Button></header>
      <div className="arcd-mobile-filter-sheet__content">{children}</div>
      <footer className="arcd-mobile-filter-sheet__actions">{onClear && <Button variant="secondary" onClick={onClear}>Limpar</Button>}<Button onClick={() => { onApply?.(); onOpenChange?.(false); }}>Aplicar filtros</Button></footer>
    </section>
  </div>, document.body);
}
