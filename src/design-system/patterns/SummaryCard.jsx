import "./styles.css";

export function SummaryCard({ label, value, detail, children }) { return <section className="arcd-summary-card"><div className="arcd-summary-card__label">{label}</div><div className="arcd-summary-card__value">{value}</div>{detail && <div className="arcd-summary-card__detail">{detail}</div>}{children}</section>; }
