import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "../design-system/primitives/Button.jsx";
import "./styles.css";

export function MobileMoreMenu({ open, onOpenChange, items = [], onNavigate }) {
  const menuRef = useRef(null);
  const previousFocus = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    const focusMenu = window.setTimeout(() => menuRef.current?.focus(), 0);
    const onKeyDown = event => { if (event.key === "Escape") onOpenChange?.(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusMenu);
      window.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [open, onOpenChange]);
  if (!open) return null;
  return <><div className="arcd-mobile-more-menu__backdrop" aria-hidden="true" onMouseDown={() => onOpenChange?.(false)} /><section ref={menuRef} className="arcd-mobile-more-menu" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="arcd-mobile-more-menu__header"><strong id={titleId}>Mais módulos</strong><Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => onOpenChange?.(false)}><X size={20} /></Button></div><div className="arcd-mobile-more-menu__items">{items.map(item => <button key={item.id} type="button" className="arcd-mobile-more-menu__item" onClick={() => { onNavigate?.(item.id); onOpenChange?.(false); }}>{item.icon}{item.label}</button>)}</div></section></>;
}
