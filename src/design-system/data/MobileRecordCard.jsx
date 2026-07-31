import { MobileRecordActions } from "./MobileRecordActions.jsx";
import { Button } from "../primitives/Button.jsx";
import "./styles.css";

function valueFor(row, descriptor) { return typeof descriptor === "function" ? descriptor(row) : row?.[descriptor]; }
function fieldFor(columns, key) { return columns.find(column => column.key === key); }
function renderValue(row, column) { return column?.render ? column.render(row) : String(column ? row[column.key] ?? "—" : "—"); }

export function MobileRecordCard({ row, columns, config = {}, onClick }) {
  const title = valueFor(row, config.title) ?? renderValue(row, columns[0]);
  const subtitle = config.subtitle ? valueFor(row, config.subtitle) : null;
  const status = config.status ? valueFor(row, config.status) : null;
  // O título já é a primeira informação lida no cartão. Repeti-lo como o
  // primeiro campo criava cartões altos e difíceis de escanear em campo.
  const fieldKeys = Array.isArray(config.primaryFields) ? config.primaryFields : columns.slice(1, 4).map(column => column.key);
  const primaryFields = fieldKeys.map(key => fieldFor(columns, key)).filter(Boolean);
  const activate = () => onClick?.(row);
  return <article className={`arcd-mobile-record-card${onClick ? " arcd-mobile-record-card--clickable" : ""}`} tabIndex={onClick ? 0 : undefined} onClick={activate} onKeyDown={event => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); activate(); } }}>
    <header className="arcd-mobile-record-card__header"><strong className="arcd-mobile-record-card__title">{title}</strong>{status != null && <span className="arcd-mobile-record-card__status">{status}</span>}</header>
    {subtitle != null && <p className="arcd-mobile-record-card__subtitle">{subtitle}</p>}
    <dl className="arcd-mobile-record-card__fields">{primaryFields.map(column => <div key={column.key}><dt>{column.header}</dt><dd>{renderValue(row, column)}</dd></div>)}</dl>
    {(onClick || config.actions?.length) && <footer className="arcd-mobile-record-card__footer">{onClick && <Button variant="ghost" size="sm" onClick={event => { event.stopPropagation(); activate(); }}>Ver detalhes</Button>}<MobileRecordActions row={row} actions={config.actions} /></footer>}
  </article>;
}
