import { Button } from "../../design-system/primitives/Button.jsx";
import "./styles.css";

export function ActiveFilterChips({ filters = [], onRemove, onClear }) {
  if (!filters.length) return null;
  return <div className="arcd-active-filter-chips" aria-label="Filtros ativos">
    {filters.map(filter => <Button key={filter.id || filter.label} variant="ghost" size="sm" onClick={() => onRemove?.(filter)}> {filter.label} × </Button>)}
    {onClear && <Button variant="link" onClick={onClear}>Limpar filtros</Button>}
  </div>;
}
