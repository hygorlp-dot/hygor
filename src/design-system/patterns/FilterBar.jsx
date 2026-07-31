import "./styles.css";

export function FilterBar({ children, label = "Filtros" }) { return <section className="arcd-filter-bar" aria-label={label}>{children}</section>; }
