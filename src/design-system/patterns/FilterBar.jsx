import "./styles.css";

export function FilterBar({ children, label = "Filtros", layout="row", align="end", className="" }) { return <section className={`arcd-filter-bar ${className}`.trim()} data-layout={layout} data-align={align} aria-label={label}>{children}</section>; }
