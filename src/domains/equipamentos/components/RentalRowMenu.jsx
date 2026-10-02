import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

const GROUP_LABEL = { ciclo: "Próximo passo", cobranca: "Cobrança", contrato: "Contrato" };
const GROUP_ORDER = ["ciclo", "cobranca", "contrato"];
const MENU_WIDTH = 256;

// Menu contextual da linha. É um portal com posição fixa (a tabela rola e
// corta overflow, então um menu "absolute" dentro dela ficaria cortado). Ele
// ACOMPANHA o botão quando a página rola e só fecha se o botão sair da tela,
// com Esc ou com clique fora. A ação destrutiva fica sozinha no fim,
// separada, nunca misturada às ações comuns.
export function RentalRowMenu({ row, actions, cycleNote = "", busy, open, onOpenChange, onDetails, onAction }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const closeRef = useRef(onOpenChange);
  closeRef.current = onOpenChange;
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const common = GROUP_ORDER.map(group => ({ group, items: actions.filter(item => item.group === group) })).filter(entry => entry.items.length);
  const danger = actions.filter(item => item.danger);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) { closeRef.current(false); return; }
    const height = menuRef.current?.offsetHeight || 320;
    const left = Math.max(8, Math.min(window.innerWidth - MENU_WIDTH - 8, rect.right - MENU_WIDTH));
    const fitsBelow = rect.bottom + 4 + height <= window.innerHeight - 8;
    setPosition({ left, top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - 4 - height) });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, actions.length, place]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => closeRef.current(false);
    const onPointerDown = event => { if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close(); };
    const onKeyDown = event => {
      if (event.key === "Escape") { event.stopPropagation(); close(); triggerRef.current?.focus(); return; }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next].focus({ preventScroll: true });
    };
    // Rolagem DENTRO do menu não reposiciona nada; fora dele, o menu segue o botão.
    const onScroll = event => { if (!(event.target instanceof Node && menuRef.current?.contains(event.target))) place(); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    const focusTimer = window.setTimeout(() => menuRef.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true }), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const run = callback => { onOpenChange(false); callback(); };
  const item = (action, extra = "") => (
    <button key={action.id} type="button" role="menuitem" className={`ro-menu__item${extra}`} disabled={busy} onClick={() => run(() => onAction(action, row))}>
      {action.label}
    </button>
  );

  return <>
    <button ref={triggerRef} type="button" className="ro-icon-button" aria-haspopup="menu" aria-expanded={open}
      aria-label={`Mais ações de ${row.equipamentoNome}`} onClick={event => { event.stopPropagation(); onOpenChange(!open); }}>
      <MoreHorizontal size={16} aria-hidden="true" />
    </button>
    {open && createPortal(
      <div ref={menuRef} className="ro-menu" role="menu" aria-label={`Ações da locação de ${row.equipamentoNome}`} style={{ top: position.top, left: position.left, width: MENU_WIDTH }}>
        <button type="button" role="menuitem" className="ro-menu__item" onClick={() => run(() => onDetails(row))}>Abrir detalhes</button>
        {cycleNote && <div role="group" aria-label="Ciclo" className="ro-menu__group"><p className="ro-menu__note">{cycleNote}</p></div>}
        {common.map(({ group, items }) => (
          <div key={group} role="group" aria-label={GROUP_LABEL[group]} className="ro-menu__group">
            <span className="ro-menu__heading" aria-hidden="true">{GROUP_LABEL[group]}</span>
            {items.map(action => item(action))}
          </div>
        ))}
        {danger.length > 0 && <div role="group" aria-label="Administrativo" className="ro-menu__group ro-menu__group--danger">
          {danger.map(action => item({ ...action, label: `${action.label}…` }, " ro-menu__item--danger"))}
        </div>}
      </div>,
      document.body,
    )}
  </>;
}
