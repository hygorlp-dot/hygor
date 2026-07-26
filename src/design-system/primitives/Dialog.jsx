import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button.jsx";
import "./styles.css";

export function Dialog({ open, onOpenChange, title, children, triggerRef, closeLabel = "Fechar", className = "" }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const previousFocus = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const onKeyDown = event => { if (event.key === "Escape") onOpenChange?.(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKeyDown); (triggerRef?.current || previousFocus.current)?.focus?.(); };
  }, [open, onOpenChange, triggerRef]);
  if (!open) return null;
  return createPortal(<div className="arcd-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange?.(false); }}>
    <section ref={dialogRef} className={`arcd-dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="arcd-dialog__header"><h2 id={titleId} className="arcd-dialog__title">{title}</h2><Button variant="ghost" size="icon" aria-label={closeLabel} title={closeLabel} onClick={() => onOpenChange?.(false)}>×</Button></header>
      <div className="arcd-dialog__body">{children}</div>
    </section>
  </div>, document.body);
}
