import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

// Menu "⋯" do cartão de pedido (R4). As ações comuns vêm primeiro; cancelar e
// excluir ficam num grupo separado no fim, longe do botão principal. Teclado:
// Enter/Espaço/↓ abrem no primeiro item, ↑ no último; ↑ ↓ Home End navegam;
// Esc fecha e devolve o foco ao botão; Tab fecha e segue a ordem da página.
export function OrderActionMenu({ label, comuns = [], destrutivas = [], busy = false, onSelect }) {
  const menuId = useId();
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const pendingFocus = useRef("first");
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState("bottom");

  const itens = () => [...(listRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') || [])];
  const close = (returnFocus = true) => { setOpen(false); if (returnFocus) triggerRef.current?.focus(); };

  // Abre para cima quando não cabe embaixo (último cartão da página, celular).
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const list = listRef.current?.getBoundingClientRect();
    if (!trigger || !list) return;
    const cabeEmbaixo = trigger.bottom + 4 + list.height <= window.innerHeight - 8;
    setPlacement(!cabeEmbaixo && trigger.top - 4 - list.height >= 8 ? "top" : "bottom");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const lista = itens();
    (pendingFocus.current === "last" ? lista[lista.length - 1] : lista[0])?.focus({ preventScroll: true });
    const fora = event => {
      if (!listRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [open]);

  const onTriggerKeyDown = event => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    pendingFocus.current = event.key === "ArrowUp" ? "last" : "first";
    setOpen(true);
  };

  const onListKeyDown = event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    const lista = itens();
    if (!lista.length) return;
    const atual = lista.indexOf(document.activeElement);
    const destino = {
      ArrowDown: (atual + 1) % lista.length,
      ArrowUp: (atual - 1 + lista.length) % lista.length,
      Home: 0,
      End: lista.length - 1,
    }[event.key];
    if (destino === undefined) return;
    event.preventDefault();
    lista[destino].focus({ preventScroll: true });
  };

  const escolher = acao => { setOpen(false); onSelect(acao.id); };
  const item = (acao, perigo) => {
    const classe = `purchase-order-menu__item${perigo ? " purchase-order-menu__item--danger" : ""}`;
    if (acao.href) {
      return <a key={acao.id} role="menuitem" tabIndex={-1} className={classe} href={acao.href} target="_blank" rel="noreferrer"
        onClick={() => setOpen(false)}>{acao.label}</a>;
    }
    return <button key={acao.id} type="button" role="menuitem" tabIndex={-1} className={classe} aria-disabled={busy || undefined}
      onClick={() => { if (!busy) escolher(acao); }}>{acao.label}{perigo ? "…" : ""}</button>;
  };

  if (!comuns.length && !destrutivas.length) return null;
  return <div className="purchase-order-menu">
    <button ref={triggerRef} type="button" className="purchase-order-menu__trigger" aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? menuId : undefined} aria-label={label} onKeyDown={onTriggerKeyDown}
      onClick={() => { pendingFocus.current = "first"; setOpen(value => !value); }}>
      <MoreHorizontal size={18} aria-hidden="true" />
    </button>
    {open && <div ref={listRef} id={menuId} role="menu" aria-label={label} data-placement={placement}
      className="purchase-order-menu__list" onKeyDown={onListKeyDown}>
      {comuns.map(acao => item(acao, false))}
      {destrutivas.length > 0 && <div role="group" aria-label="Ações irreversíveis" className="purchase-order-menu__danger">
        {destrutivas.map(acao => item(acao, true))}
      </div>}
    </div>}
  </div>;
}
