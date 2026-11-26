// @ts-check
import { authorizeSectionChanges } from "./section-authorizations.js";
import { findSectionConflicts } from "./three-way-conflicts.js";

/** @typedef {import("./legacy-save-contract.js").SaveSections} Sections */
/** @typedef {Record<string, SaveVersion>} RowVersions */
/** @typedef {{id: string, role: string, obraId?: string | null}} Actor */
/** @typedef {import("./legacy-save-contract.js").SaveAction} SaveAction */
/** @typedef {{payload: Sections | null, updatedAt: SaveVersion, rowVersions: RowVersions}} Snapshot */
/** @typedef {{expectedUpdatedAt: SaveVersion, value: Sections, rowVersions: RowVersions, actor: Actor, action: SaveAction, before: Sections, after: Sections}} SaveAttempt */
/** @typedef {import("./legacy-save-contract.js").SaveConflict} SaveConflict */
/** @typedef {import("./legacy-save-contract.js").SaveVersion} SaveVersion */
/** @typedef {{ok: true, value: Sections, updatedAt: SaveVersion, replayed?: boolean} | {ok: false, status: 403, body: {error: string}} | {ok: false, status: 409, body: SaveConflict}} RetryResult */
/**
 * @param {{
 *   readCurrent: () => Promise<Snapshot>,
 *   base: Sections | null | undefined,
 *   incoming: Sections,
 *   keys: string[],
 *   sections: Sections,
 *   merge: (current: Sections | null) => Sections,
 *   save: (attempt: SaveAttempt) => Promise<import("./legacy-save-contract.js").SaveReceipt>,
 *   actor: Actor,
 *   action: SaveAction,
 *   onRetry?: () => void,
 * }} options
 * @returns {Promise<RetryResult>}
 */
export async function retryLegacySave({
  readCurrent, base, incoming, keys, sections, merge, save, actor, action, onRetry,
}) {
  const current = await readCurrent();
  const conflicts = findSectionConflicts(base, incoming, current.payload, keys);
  if (conflicts.length) {
    return { ok: false, status: 409, body: {
      conflict: true,
      reason: "Outro operador alterou o mesmo registro. Atualize os dados antes de tentar novamente.",
      conflicts,
      currentUpdatedAt: current.updatedAt,
    } };
  }

  const value = merge(current.payload);
  const error = authorizeSectionChanges(actor, sections, { before: current.payload, after: value });
  if (error) return { ok: false, status: 403, body: { error } };

  onRetry?.();
  const retry = await save({
    expectedUpdatedAt: current.updatedAt,
    value,
    rowVersions: current.rowVersions,
    actor,
    action,
    before: Object.fromEntries(keys.map(key => [key, current.payload?.[key]])),
    after: Object.fromEntries(keys.map(key => [key, value?.[key]])),
  });
  if (!retry.applied) {
    return { ok: false, status: 409, body: { conflict: true, reason: "Muitas alterações simultâneas. Tente novamente." } };
  }
  return { ok: true, value, updatedAt: retry.updatedAt, ...(retry.replayed ? { replayed: true } : {}) };
}
