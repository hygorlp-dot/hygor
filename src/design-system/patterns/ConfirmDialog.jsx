import { useState } from "react";
import {UI_TEXT} from '../copy.js';
import { Button } from "../primitives/Button.jsx";
import { Dialog } from "../primitives/Dialog.jsx";
import { Textarea } from "../primitives/Textarea.jsx";

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = UI_TEXT.actions.confirm, cancelLabel = UI_TEXT.actions.cancel, tone = "primary", requireReason = false, onConfirm, triggerRef }) {
  const [reason, setReason] = useState("");
  const confirm = async () => { await onConfirm?.(reason); setReason(""); onOpenChange?.(false); };
  return <Dialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef} title={title} footer={<>
    <Button variant="secondary" onClick={() => onOpenChange?.(false)}>{cancelLabel}</Button>
    <Button variant={tone === "danger" ? "danger" : "primary"} disabled={requireReason && !reason.trim()} onClick={confirm}>{confirmLabel}</Button>
  </>}>
    <div className="mrc-dialog-fields">
      {description && <p>{description}</p>}
      {requireReason && <Textarea label={UI_TEXT.confirmation.reason} value={reason} onChange={event => setReason(event.target.value)} required error={!reason ? UI_TEXT.confirmation.reasonRequired : undefined} />}
    </div>
  </Dialog>;
}
