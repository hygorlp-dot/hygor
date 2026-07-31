import "./styles.css";

export function SummaryCard({ label, value, detail, icon, tone="neutral", onClick, children }) {
  const Component=onClick?"button":"section";
  return <Component type={onClick?"button":undefined} onClick={onClick} className="arcd-summary-card" data-tone={tone} data-interactive={Boolean(onClick)}>
    <div className="arcd-summary-card__head"><div className="arcd-summary-card__label">{label}</div>{icon&&<span className="arcd-summary-card__icon">{icon}</span>}</div>
    <div className="arcd-summary-card__value">{value}</div>
    {detail&&<div className="arcd-summary-card__detail">{detail}</div>}{children}
  </Component>;
}
