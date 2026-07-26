import { Button } from "../../design-system/primitives/Button.jsx";

export function MobileEditorHeader({ title, onClose, closeLabel = "Fechar editor" }) {
  return <header className="arcd-mobile-editor__header">
    <Button variant="ghost" size="icon" aria-label={closeLabel} title={closeLabel} onClick={onClose}>×</Button>
    <h2 className="arcd-mobile-editor__title">{title}</h2>
  </header>;
}
