import {useDialogLifecycle} from './useDialogLifecycle.js';
import {useRecoveredEditor,SaveRecoveryShortcut} from '../../features/workflow/SaveRecoveryContext.jsx';
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button.jsx";
import "./styles.css";

export function DialogSurface({ id, open, onOpenChange, title, children, triggerRef, closeLabel = "Fechar", className = "", drawer = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const overlayRef=useRef(null);
  const {stale,editorId}=useRecoveredEditor(open);
  useDialogLifecycle(open,dialogRef,()=>onOpenChange?.(false),triggerRef,overlayRef);
  if (!open) return null;
  const Surface=drawer?'aside':'section';
  const content=<><header className="arcd-dialog__header"><h2 id={titleId} className="arcd-dialog__title">{title}</h2><Button variant="ghost" size="icon" aria-label={closeLabel} title={closeLabel} onClick={() => onOpenChange?.(false)}>×</Button></header><div className="arcd-dialog__body"><SaveRecoveryShortcut stale={stale}/><fieldset disabled={stale} className="m-0 min-w-0 border-0 p-0">{children}</fieldset></div></>;
  return createPortal(<div ref={overlayRef} className="arcd-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange?.(false); }}>
    <Surface id={id} ref={dialogRef} data-recovery-editor={editorId} className={`${drawer?'arcd-drawer':'arcd-dialog'} ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      {drawer?<div className="arcd-drawer__content">{content}</div>:content}
    </Surface>
  </div>, document.body);
}
export const Dialog=DialogSurface;
