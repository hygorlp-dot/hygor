import { FieldActionCard } from "./FieldActionCard.jsx";
import "./styles.css";
export function FieldActionGrid({ actions = [], onSelect }) { return <section className="arcd-field-action-grid" aria-label="Ações de campo">{actions.map(action => <FieldActionCard key={action.id} action={action} onSelect={onSelect} />)}</section>; }
