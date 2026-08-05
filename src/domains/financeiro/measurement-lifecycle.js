import { active } from "./ledger.js";

const ARCHIVED = new Set(["arquivado", "arquivada", "archived"]);
const statusOf = item => String(item?.status || "").trim().toLowerCase();

// Arquivar preserva receita e recebimentos no razão, mas congela a parcela
// para impedir reescrita de um fato histórico. Cancelamento/estorno também
// bloqueia mutação e, por meio de `active`, elimina o efeito econômico.
export const isClientMeasurementMutable = item =>
  active(item) && !ARCHIVED.has(statusOf(item));

export const isClientMeasurementArchived = item => ARCHIVED.has(statusOf(item));
