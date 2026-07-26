import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorForm } from "../../edit-engine/EditorForm.jsx";
import { UnsavedChangesGuard } from "../../edit-engine/UnsavedChangesGuard.jsx";
import { useEntityEditor } from "../../edit-engine/hooks/useEntityEditor.js";
import { KeyboardAwareContainer } from "./KeyboardAwareContainer.jsx";
import { MobileEditorHeader } from "./MobileEditorHeader.jsx";
import { StickyFormActions } from "./StickyFormActions.jsx";
import "./styles.css";

export function FullScreenEditor({ open, onOpenChange, schema, initialValues, onSubmit, readOnly = false, forbidden = false }) {
  const editor = useEntityEditor({ schema, initialValues, onSubmit, readOnly, forbidden });
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);
  const titleId = useId();
  const [showGuard, setShowGuard] = useState(false);
  const title = initialValues?.id ? schema.title.edit : schema.title.create;
  const requestClose = useCallback(() => {
    if (editor.dirty) setShowGuard(true);
    else onOpenChange?.(false);
  }, [editor.dirty, onOpenChange]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    const onKeyDown = event => { if (event.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => { window.removeEventListener("keydown", onKeyDown); window.clearTimeout(timer); previousFocus.current?.focus?.(); };
  }, [open, requestClose]);

  if (!open) return null;
  return createPortal(<section ref={dialogRef} className="arcd-mobile-editor" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
    <div id={titleId}><MobileEditorHeader title={title} onClose={requestClose} /></div>
    <KeyboardAwareContainer><EditorForm schema={schema} values={editor.values} errors={editor.errors} status={editor.status} readOnly={readOnly} forbidden={forbidden} onChange={editor.setValue} onSubmit={editor.submit} footer={false} /></KeyboardAwareContainer>
    {!forbidden && <StickyFormActions onCancel={requestClose} onSave={editor.submit} saving={editor.status === "saving"} disabled={readOnly} />}
    <UnsavedChangesGuard open={showGuard} onStay={() => setShowGuard(false)} onDiscard={() => { editor.reset(); setShowGuard(false); onOpenChange?.(false); }} />
  </section>, document.body);
}
