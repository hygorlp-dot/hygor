// @ts-check
import { expandSectionDelta } from "../src/domains/sync/section-delta.js";

/** @typedef {Record<string, unknown>} SaveSections */
/** @typedef {string | Date | null | undefined} SaveVersion */
/** @typedef {"save" | "save-sections"} SaveOperation */
/** @typedef {"save_blob" | "save_sections" | "financial_shadow_save_blob" | "financial_shadow_save_sections"} SaveAction */
/** @typedef {{applied: boolean, updatedAt: SaveVersion, replayed?: boolean}} SaveReceipt */
/** @typedef {SaveReceipt & {correlationId: string}} AuditedSaveReceipt */
/** @typedef {{section: string, id: string}} SectionConflict */
/** @typedef {{conflict: true, reason: string, error?: string, conflicts?: SectionConflict[], currentData?: SaveSections, currentUpdatedAt?: SaveVersion}} SaveConflict */
/** @typedef {{error: string, code?: string, section?: string, closedDreChanges?: readonly unknown[]}} SaveRejection */
/** @typedef {{ok: true, updatedAt: SaveVersion, unchanged: true} | {ok: true, updatedAt: SaveVersion, merged: boolean | null | undefined | "" | 0, data: SaveSections | undefined, savedSections?: string[], replayed?: boolean}} SaveSuccess */
/** @typedef {[status: 200, body: SaveSuccess] | [status: 409, body: SaveRejection | SaveConflict] | [status: 400 | 403 | 404 | 503, body: SaveRejection]} SaveReply */
/** @typedef {{payload?: unknown, basePayload?: unknown, expectedUpdatedAt?: unknown, operationId?: unknown}} BlobSaveRequest */
/** @typedef {{sections?: unknown, baseSections?: unknown, sectionDeltas?: unknown, expectedUpdatedAt?: unknown, operationId?: unknown}} SectionSaveRequest */
/** @typedef {{ok: false, error: string}} InvalidSaveInput */
/** @typedef {{ok: true, payload: NonNullable<unknown>, basePayload: unknown, expectedUpdatedAt: unknown}} BlobSaveInput */
/** @typedef {{ok: true, sections: SaveSections, baseSections: unknown, expectedUpdatedAt: unknown, keys: string[]}} SectionSaveInput */

/**
 * @param {unknown} value
 * @returns {value is SaveSections}
 */
const isSectionMap = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * O envio completo legado valida presença. A autorização e as guardas de
 * domínio examinam o conteúdo depois, na mesma ordem da rota original.
 * @param {BlobSaveRequest} request
 * @returns {BlobSaveInput | InvalidSaveInput}
 */
export function prepareBlobSave({ payload, basePayload, expectedUpdatedAt }) {
  if (!payload) return { ok: false, error: "Nada para salvar." };
  return { ok: true, payload, basePayload, expectedUpdatedAt };
}

/**
 * Reconstrói deltas sobre a fotografia atual antes das guardas. Uma seção de
 * primeiro cadastro pode ter base ausente mesmo com alteração presente.
 * @param {SectionSaveRequest} request
 * @param {SaveSections | null | undefined} current
 * @returns {SectionSaveInput | InvalidSaveInput}
 */
export function prepareSectionSave({ sections, baseSections, sectionDeltas, expectedUpdatedAt }, current) {
  if (isSectionMap(sectionDeltas)) {
    const complete = { ...(isSectionMap(sections) ? sections : {}) };
    const bases = { ...(isSectionMap(baseSections) ? baseSections : {}) };
    for (const [key, delta] of Object.entries(sectionDeltas).slice(0, 120)) {
      if (!key || key.startsWith("__")) continue;
      const expanded = expandSectionDelta(delta, current?.[key]);
      if (!expanded) return { ok: false, error: `Alteração da seção ${key} em formato inválido.` };
      complete[key] = expanded.incoming;
      bases[key] = expanded.base;
    }
    sections = complete;
    baseSections = bases;
  }
  if (!isSectionMap(sections)) return { ok: false, error: "Nenhuma seção para salvar." };
  const keys = Object.keys(sections).filter(key => key && !key.startsWith("__")).slice(0, 120);
  return { ok: true, sections, baseSections, expectedUpdatedAt, keys };
}

/**
 * Conserva a coerção legada de Date e compara carimbos pelo instante.
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function sameSaveInstant(left, right) {
  const a = new Date(/** @type {string | number} */ (left)).getTime();
  const b = new Date(/** @type {string | number} */ (right)).getTime();
  return a === b;
}

/**
 * @param {SaveOperation} operation
 * @param {boolean} financial
 * @returns {SaveAction}
 */
export function legacySaveAuditAction(operation, financial) {
  if (operation === "save") return financial ? "financial_shadow_save_blob" : "save_blob";
  return financial ? "financial_shadow_save_sections" : "save_sections";
}

/**
 * @template Result
 * @param {{status: (code: number) => {json: (body: SaveReply[1]) => Result}}} response
 * @returns {(...reply: SaveReply) => Result}
 */
export function legacySaveResponder(response) {
  return (status, body) => response.status(status).json(body);
}
