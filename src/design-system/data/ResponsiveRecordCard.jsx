import "./styles.css";

export function ResponsiveRecordCard({ row, columns, onClick }) {
  return <article className="arcd-record-card" tabIndex={onClick ? 0 : undefined} onClick={() => onClick?.(row)} onKeyDown={event => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(row); } }}>
    {columns.map(column => <div className="arcd-record-card__field" key={column.key}><span className="arcd-record-card__label">{column.header}</span><span className="arcd-record-card__value">{column.render ? column.render(row) : String(row[column.key] ?? "—")}</span></div>)}
  </article>;
}
