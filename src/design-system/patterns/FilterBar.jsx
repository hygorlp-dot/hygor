import "./styles.css";

export function FilterBar({ children, label = "Filtros", layout="row", className="" }) { return <section className={`arcd-filter-bar ${className}`.trim()} data-layout={layout} aria-label={label}>{children}</section>; }
