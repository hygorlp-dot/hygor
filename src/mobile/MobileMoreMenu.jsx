import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "../design-system/primitives/Button.jsx";
import "./styles.css";

export function MobileMoreMenu({ id, open, onOpenChange, items = [], onNavigate }) {
  const menuRef = useRef(null);
  const previousFocus = useRef(null);
  const previousOverflow = useRef("");
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    previousOverflow.current = document.body.style.overflow;
    document.body.classList.add("no-scroll");
    document.body.style.overflow = "hidden";
    const focusMenu = window.setTimeout(() => menuRef.current?.focus(), 0);
    const onKeyDown = event => { if (event.key === "Escape") onOpenChange?.(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusMenu);
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("no-scroll");
      document.body.style.overflow = previousOverflow.current;
      previousFocus.current?.focus?.();
    };
  }, [open, onOpenChange]);
  if (!open) return null;
  return <><div className="arcd-mobile-more-menu__backdrop" aria-hidden="true" onMouseDown={() => onOpenChange?.(false)} /><section id={id} ref={menuRef} className="arcd-mobile-more-menu" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="arcd-mobile-more-menu__header"><strong id={titleId}>Mais setores</strong><Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => onOpenChange?.(false)}><X size={20} /></Button></div><div className="arcd-mobile-more-menu__items">{items.map(item => <button key={item.id} type="button" className="arcd-mobile-more-menu__item" data-active={item.active || undefined} aria-current={item.active ? "page" : undefined} onClick={() => { onNavigate?.(item.id); onOpenChange?.(false); }}>{item.icon}<span>{item.label}</span></button>)}</div></section></>;
}
