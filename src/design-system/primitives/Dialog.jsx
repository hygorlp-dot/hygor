import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button.jsx";
import "./styles.css";

export function Dialog({ id, open, onOpenChange, title, children, triggerRef, closeLabel = "Fechar", className = "" }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const previousFocus = useRef(null);
  const previousOverflow = useRef("");
  const onChangeRef=useRef(onOpenChange);
  onChangeRef.current=onOpenChange;
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const onKeyDown = event => {
      const dialog=dialogRef.current;
      if([...document.querySelectorAll('.arcd-dialog')].at(-1)!==dialog)return;
      if(event.key==='Escape'){event.stopPropagation();onChangeRef.current?.(false);return;}
      if(event.key!=='Tab')return;
      const targets=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(el=>el.tabIndex>=0&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&el.getAttribute('aria-disabled')!=='true');
      if(!targets.length){event.preventDefault();dialog.focus();return;}
      const active=document.activeElement,first=targets[0],last=targets.at(-1);
      if(event.shiftKey&&(active===first||active===dialog||!dialog.contains(active))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(active===last||active===dialog||!dialog.contains(active))){event.preventDefault();first.focus();}
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow.current; (triggerRef?.current || previousFocus.current)?.focus?.(); };
  }, [open, triggerRef]);
  if (!open) return null;
  return createPortal(<div className="arcd-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange?.(false); }}>
    <section id={id} ref={dialogRef} className={`arcd-dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="arcd-dialog__header"><h2 id={titleId} className="arcd-dialog__title">{title}</h2><Button variant="ghost" size="icon" aria-label={closeLabel} title={closeLabel} onClick={() => onOpenChange?.(false)}>×</Button></header>
      <div className="arcd-dialog__body">{children}</div>
    </section>
  </div>, document.body);
}
