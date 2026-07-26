import { useState } from "react";
import { EditorForm } from "./EditorForm.jsx";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard.jsx";
import { useEntityEditor } from "./hooks/useEntityEditor.js";

export function EntityEditor({ schema, initialValues, onSubmit, readOnly, forbidden, onRequestClose }) {
  const editor = useEntityEditor({ schema, initialValues, onSubmit, readOnly, forbidden });
  const [showGuard, setShowGuard] = useState(false);
  const requestClose = () => { if (editor.dirty) setShowGuard(true); else onRequestClose?.(); };
  return <><EditorForm schema={schema} values={editor.values} errors={editor.errors} status={editor.status} readOnly={readOnly} forbidden={forbidden} onChange={editor.setValue} onSubmit={editor.submit} onCancel={onRequestClose ? requestClose : undefined} /><UnsavedChangesGuard open={showGuard} onStay={() => setShowGuard(false)} onDiscard={() => { editor.reset(); setShowGuard(false); onRequestClose?.(); }} /></>;
}
