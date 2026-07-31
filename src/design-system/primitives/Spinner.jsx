import "./styles.css";

export function Spinner({ label = "Carregando", className = "" }) {
  return <span className={`arcd-spinner ${className}`.trim()} role="status" aria-label={label}><span className="sr-only">{label}</span></span>;
}
