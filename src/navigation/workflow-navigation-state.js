// @ts-check
import { normalizeWorkflowScope } from "../features/workflow/workflow-model.js";

/** @typedef {{ id?: string, obraId?: string }} NavigationUser */
/** @typedef {{ obraId?: string, year?: number|string|null, month?: number|string|null, period?: string }} NavigationScope */
/** @typedef {ReturnType<typeof normalizeWorkflowScope>} NormalizedScope */
/** @typedef {{ scope?: NavigationScope, action?: string, linked?: boolean, record?: unknown, preserveHistory?: boolean }} NavigationOptions */
/** @typedef {{ tabId: string, scope: NormalizedScope, action: string, linked: boolean, record: unknown, sequence: number }} NavigationIntent */
/** @typedef {{ tabId: string, obraId: string, contextObraId: string, scope: NormalizedScope }} WorkflowTrailEntry */

/**
 * @param {NavigationIntent|null} previous
 * @param {string} tabId
 * @param {string} obraId
 * @param {NavigationOptions} options
 * @param {NavigationScope} lastScope
 * @param {NavigationUser} user
 * @returns {NavigationIntent}
 */
export function nextNavigationIntent(previous, tabId, obraId, options, lastScope, user) {
  const scope = normalizeWorkflowScope(options.scope || { ...lastScope, ...(obraId ? { obraId } : {}) }, user);
  return {
    tabId,
    scope,
    action: options.action || "navigate",
    linked: Boolean(options.linked),
    record: options.record || null,
    sequence: (previous?.sequence || 0) + 1,
  };
}

/**
 * @param {WorkflowTrailEntry[]} trail
 * @param {WorkflowTrailEntry} entry
 * @returns {WorkflowTrailEntry[]}
 */
export function rememberWorkflowOrigin(trail, entry) {
  return [...trail.slice(-7), entry];
}
