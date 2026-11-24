import {useDialogLifecycle} from './useDialogLifecycle.js';
import {useRecoveredEditor,SaveRecoveryShortcut} from '../../features/workflow/SaveRecoveryContext.jsx';
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button.jsx";
import "./styles.css";

export function DialogSurface({ id, open, onOpenChange, title, children, triggerRef, closeLabel = "Fechar", className = "", drawer = false, size, protectEdits = true, legacy = false, footer = null }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const overlayRef=useRef(null);
  const {stale,editorId}=useRecoveredEditor(open);
  useDialogLifecycle(open,dialogRef,()=>onOpenChange?.(false),triggerRef,overlayRef);
  if (!open) return null;
  const Surface=drawer?'aside':'section';
  const panelClass=drawer?'arcd-drawer':'arcd-dialog';
  const content=<>
    <header className={legacy?"arcd-dialog__header arcd-modal-header":"arcd-dialog__header"}>
      <h2 id={titleId} className="arcd-dialog__title">{title}</h2>
      <Button variant="ghost" size="icon" aria-label={closeLabel} title={closeLabel} onClick={() => onOpenChange?.(false)}>
        <X size={16} aria-hidden="true"/>
      </Button>
    </header>
    {legacy&&<div className="arcd-modal-notice"/>}
    <div className={legacy?"arcd-dialog__body arcd-modal-body":"arcd-dialog__body"}>
      {protectEdits?<><SaveRecoveryShortcut stale={stale}/><fieldset disabled={stale} className="m-0 min-w-0 border-0 p-0">{children}</fieldset></>:children}
    </div>
    {footer&&<footer className={legacy?"arcd-dialog__footer arcd-modal-footer":"arcd-dialog__footer"}>
      <fieldset disabled={protectEdits&&stale} className="mrc-dialog-actions">{footer}</fieldset>
    </footer>}
  </>;
  return createPortal(<div ref={overlayRef} className={legacy?"no-print arcd-dialog-backdrop arcd-modal-overlay":"no-print arcd-dialog-backdrop"} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange?.(false); }}>
    <Surface id={id} ref={dialogRef} data-size={size} data-recovery-editor={protectEdits?editorId:undefined} className={`${panelClass}${legacy?' arcd-modal-panel':''} ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      {drawer?<div className="arcd-drawer__content">{content}</div>:content}
    </Surface>
  </div>, document.body);
}
export const Dialog=DialogSurface;
