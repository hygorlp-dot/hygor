import { useState } from "react";
import { Button } from "../primitives/Button.jsx";

export function DataTableColumnMenu({ columns, visible, onChange }) {
  const [open, setOpen] = useState(false);
  return <div style={{ position: "relative" }}><Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(value => !value)}>Colunas</Button>{open && <div role="menu" style={{ position: "absolute", right: 0, zIndex: 2, minWidth: "12rem", padding: "var(--arcd-space-2)", border: "1px solid var(--arcd-color-border)", borderRadius: "var(--arcd-radius-md)", background: "var(--arcd-color-surface)", boxShadow: "var(--arcd-shadow-md)" }}>{columns.filter(column => column.hideable !== false).map(column => <label key={column.key} style={{ display: "flex", gap: "var(--arcd-space-2)", padding: "var(--arcd-space-1)", fontSize: "var(--arcd-font-size-sm)" }}><input type="checkbox" checked={visible.includes(column.key)} onChange={() => onChange(column.key)} />{column.header}</label>)}</div>}</div>;
}
