import { Badge } from "../primitives/Badge.jsx";

export const statusCatalog = {
  active: { label: "Ativo", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  draft: { label: "Rascunho", tone: "neutral" },
  cancelled: { label: "Cancelado", tone: "danger" },
  completed: { label: "Concluído", tone: "success" },
};

export function StatusBadge({ status, catalog = statusCatalog }) {
  const fallback = { label: status || "Não informado", tone: "neutral" };
  const display = catalog[status] || fallback;
  return <Badge tone={display.tone}>{display.label}</Badge>;
}
