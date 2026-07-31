import { useState } from "react";
import { Button } from "../primitives/Button.jsx";
import { Dialog } from "../primitives/Dialog.jsx";
import { Textarea } from "../primitives/Textarea.jsx";

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirmar", cancelLabel = "Cancelar", tone = "primary", requireReason = false, onConfirm, triggerRef }) {
  const [reason, setReason] = useState("");
  const confirm = async () => { await onConfirm?.(reason); setReason(""); onOpenChange?.(false); };
  return <Dialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef} title={title}>
    {description && <p>{description}</p>}
    {requireReason && <div style={{ marginTop: "var(--arcd-space-4)" }}><Textarea label="Motivo" value={reason} onChange={event => setReason(event.target.value)} required error={!reason ? "Informe o motivo para continuar." : undefined} /></div>}
    <div className="arcd-page-header__actions" style={{ marginTop: "var(--arcd-space-5)", justifyContent: "flex-end" }}><Button variant="secondary" onClick={() => onOpenChange?.(false)}>{cancelLabel}</Button><Button variant={tone === "danger" ? "danger" : "primary"} disabled={requireReason && !reason.trim()} onClick={confirm}>{confirmLabel}</Button></div>
  </Dialog>;
}
