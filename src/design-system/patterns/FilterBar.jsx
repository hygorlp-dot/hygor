import "./styles.css";

export function FilterBar({ children, label = "Filtros", layout="row", align="end", className="", legend, disabled }) {
  const classes = `arcd-filter-bar ${className}`.trim();
  if (legend) return <fieldset className={classes} data-layout={layout} data-align={align} disabled={disabled}>
    <legend>{legend}</legend>
    {children}
  </fieldset>;
  return <section className={classes} data-layout={layout} data-align={align} aria-label={label}>{children}</section>;
}
