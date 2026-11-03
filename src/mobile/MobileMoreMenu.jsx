import { Dialog } from "../design-system/primitives/Dialog.jsx";
import "./styles.css";

// The shared dialog portals outside the bottom navigation and owns focus,
// Escape, backdrop and scroll locking. Hiding the navigation cannot hide it.
export function MobileMoreMenu({ id, open, onOpenChange, items = [], onNavigate, footer }) {
  return <Dialog id={id} open={open} onOpenChange={onOpenChange} title="Mais módulos" closeLabel="Fechar menu">
    <div className="arcd-mobile-more-menu__items">
      {items.map(item => <button key={item.id} type="button" className="arcd-mobile-more-menu__item"
        data-active={item.active || undefined} aria-current={item.active ? "page" : undefined}
        onClick={() => { onNavigate?.(item.id); onOpenChange?.(false); }}>
        {item.icon}<span>{item.label}</span>
      </button>)}
    </div>
    {footer}
  </Dialog>;
}
