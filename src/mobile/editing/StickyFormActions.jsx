import { Button } from "../../design-system/primitives/Button.jsx";

export function StickyFormActions({ onCancel, onSave, saving = false, disabled = false }) {
  return <footer className="arcd-mobile-editor__actions" data-sticky-actions="true">
    <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button>
    <Button onClick={onSave} loading={saving} disabled={disabled || saving}>{saving ? "Salvando" : "Salvar"}</Button>
  </footer>;
}
