import "./styles.css";

export function FieldActionCard({ action, onSelect }) {
  const Icon = action.icon;
  return <button type="button" className="arcd-field-action-card" disabled={action.disabled} onClick={() => !action.disabled && onSelect?.(action.id)}><span className="arcd-field-action-card__icon">{Icon && <Icon size={22} aria-hidden="true" />}</span><span><span className="arcd-field-action-card__title">{action.label}</span>{action.description && <span className="arcd-field-action-card__description">{action.description}</span>}</span></button>;
}
