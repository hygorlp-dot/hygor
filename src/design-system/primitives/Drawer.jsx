import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button.jsx";
import "./styles.css";

export function Drawer({ open, onOpenChange, title, children, triggerRef, closeLabel = "Fechar" }) {
  const drawerRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => { if (event.key === "Escape") onOpenChange?.(false); };
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => drawerRef.current?.focus(), 0);
    return () => { window.removeEventListener("keydown", onKeyDown); triggerRef?.current?.focus?.(); };
  }, [open, onOpenChange, triggerRef]);
  if (!open) return null;
  return createPortal(<div className="arcd-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange?.(false); }}><aside ref={drawerRef} className="arcd-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="arcd-drawer__content"><header className="arcd-dialog__header"><h2 id={titleId} className="arcd-dialog__title">{title}</h2><Button variant="ghost" size="icon" aria-label={closeLabel} onClick={() => onOpenChange?.(false)}>×</Button></header><div className="arcd-dialog__body">{children}</div></div></aside></div>, document.body);
}
