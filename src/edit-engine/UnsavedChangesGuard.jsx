import { ConfirmDialog } from "../design-system/patterns/ConfirmDialog.jsx";

export function UnsavedChangesGuard({ open, onStay, onDiscard }) { return <ConfirmDialog open={open} onOpenChange={next => !next && onStay?.()} title="Existem alterações não salvas" description="Deseja descartar as alterações?" confirmLabel="Descartar alterações" cancelLabel="Continuar editando" tone="danger" onConfirm={onDiscard} />; }
