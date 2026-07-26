import { Button } from "../../design-system/primitives/Button.jsx";
import { SUPPLIER_CATEGORIES } from "./categories.js";

export function SupplierCategoriesField({ value = [], onChange, disabled, readOnly, error }) {
  const categories = Array.isArray(value) ? value : [];
  const toggle = category => onChange(categories.includes(category) ? categories.filter(item => item !== category) : [...categories, category]);
  return <fieldset disabled={disabled || readOnly} style={{ border: "1px solid var(--arcd-color-border)", borderRadius: "var(--arcd-radius-lg)", padding: "var(--arcd-space-4)" }}>
    <legend style={{ padding: "0 var(--arcd-space-1)", fontSize: "var(--arcd-font-size-sm)", fontWeight: "var(--arcd-font-weight-semibold)" }}>O que fornece</legend>
    <p style={{ margin: "0 0 var(--arcd-space-3)", color: "var(--arcd-color-text-muted)", fontSize: "var(--arcd-font-size-xs)" }}>Os ramos mantêm as sugestões de fornecedor nas compras.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--arcd-space-2)" }}>{SUPPLIER_CATEGORIES.map(category => <Button key={category.v} type="button" size="sm" variant={categories.includes(category.v) ? "primary" : "secondary"} aria-pressed={categories.includes(category.v)} onClick={() => toggle(category.v)}>{category.l}</Button>)}</div>
    {error && <p role="alert" style={{ color: "var(--arcd-color-danger)", fontSize: "var(--arcd-font-size-xs)" }}>{error}</p>}
  </fieldset>;
}
