// @ts-check
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";

// Ordem histórica de precedência dos identificadores gravados na auditoria.
/** @type {ReadonlyArray<ReadonlyArray<string | number>>} */
const ENTITY_ID_PATHS = [
  ["statement", "id"],
  ["targets", 0, "id"],
  ["contractId"],
  ["medicaoTecnicaId"],
  ["expenseId"],
  ["measurementId"],
  ["pedidoId"],
  ["targetId"],
  ["paymentId"],
  ["recordId"],
  ["reportId"],
  ["commitmentId"],
  ["rentalId"],
  ["unavailabilityId"],
  ["equipmentId"],
  ["assetId"],
  ["rescissionId"],
  ["advanceId"],
  ["projectId"],
  ["payment", "id"],
  ["expense", "id"],
  ["rescission", "id"],
  ["employee", "id"],
  ["advance", "id"],
  ["project", "id"],
  ["request", "id"],
  ["supplier", "id"],
  ["material", "id"],
  ["report", "id"],
  ["measurement", "id"],
  ["record", "id"],
  ["commitment", "id"],
  ["equipment", "id"],
  ["asset", "id"],
  ["assets", 0, "id"],
  ["rental", "id"],
  ["unavailability", "id"],
  ["maintenance", "id"],
  ["transfer", "id"],
  ["records", 0, "id"],
];

/**
 * @param {unknown} payload
 * @param {readonly (string | number)[]} path
 */
function readPath(payload, path) {
  let value = payload;
  for (const key of path) {
    if (value == null) return undefined;
    value = (/** @type {Record<PropertyKey, unknown>} */ (value))[key];
  }
  return value;
}

/** @param {unknown} payload */
function findEntityId(payload) {
  for (const path of ENTITY_ID_PATHS) {
    const entityId = readPath(payload, path);
    if (entityId) return entityId;
  }
}

/**
 * Monta a mesma evidência para a transação com bloqueio e para o fallback.
 * @param {{type?: string, payload?: unknown, idempotencyKey?: string}} command
 */
export function buildOperationalCommandAudit(command) {
  const fallbackId = command.type === OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED ? "company-config" : "";
  return {
    before: {command: command.type, entityId: findEntityId(command.payload) ?? fallbackId},
    after: {command: command.type, idempotencyKey: command.idempotencyKey},
  };
}
