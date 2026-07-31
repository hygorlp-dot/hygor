import { useEffect, useRef, useState } from "react";
import { Button } from "../primitives/Button.jsx";
import "./styles.css";

export function MobileRecordActions({ row, actions = [] }) {
  const [open, setOpen] = useState(false);
  const actionsRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = event => { if (!actionsRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = event => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus?.(); } };
    document.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutside); window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  if (!actions.length) return null;
  const regular = actions.filter(action => action.tone !== "danger");
  const destructive = actions.filter(action => action.tone === "danger");
  const run = action => { setOpen(false); action.onSelect?.(row); };
  return <div ref={actionsRef} className="arcd-mobile-record-actions">
    <Button ref={triggerRef} variant="ghost" size="sm" aria-expanded={open} aria-haspopup="menu" onClick={event => { event.stopPropagation(); setOpen(value => !value); }}>Mais</Button>
    {open && <div className="arcd-mobile-record-actions__menu" role="menu" onClick={event => event.stopPropagation()}>{regular.map(action => <button key={action.id || action.label} type="button" role="menuitem" onClick={() => run(action)}>{action.label}</button>)}{destructive.length > 0 && <div className="arcd-mobile-record-actions__danger">{destructive.map(action => <button key={action.id || action.label} type="button" role="menuitem" onClick={() => run(action)}>{action.label}</button>)}</div>}</div>}
  </div>;
}
