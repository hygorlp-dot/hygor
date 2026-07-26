import "./styles.css";

export function DataTableToolbar({ search, value, onChange, children }) {
  return <div className="arcd-data-table__toolbar">{search && <input className="arcd-data-table__search" aria-label={search.placeholder || "Buscar"} placeholder={search.placeholder || "Buscar"} value={value} onChange={event => onChange(event.target.value)} />}{children}</div>;
}
