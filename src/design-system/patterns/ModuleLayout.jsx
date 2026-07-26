import "./styles.css";

export function ModuleLayout({ header, filters, children, className = "" }) {
  return <main className={`arcd-module ${className}`.trim()}>{header && <div className="arcd-module__header">{header}</div>}{filters && <div className="arcd-module__filters">{filters}</div>}<div className="arcd-module__content">{children}</div></main>;
}
