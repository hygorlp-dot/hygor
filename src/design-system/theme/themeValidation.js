import { DEFAULT_THEME, enabledThemeIds } from "../themes/themeRegistry.js";

export const DEFAULT_DENSITY = "comfortable";
export const densityOptions = Object.freeze(["compact", "comfortable", "spacious"]);
export const REQUIRED_THEME_TOKENS = Object.freeze([
  "--arcd-surface-page", "--arcd-surface-card", "--arcd-surface-muted",
  "--arcd-text-primary", "--arcd-text-secondary", "--arcd-border-default",
  "--arcd-action-primary", "--arcd-action-primary-text", "--arcd-focus-ring",
]);

export function isEnabledTheme(theme) { return enabledThemeIds.includes(theme); }
export function isValidDensity(density) { return densityOptions.includes(density); }
export function normalizeTheme(theme) { return isEnabledTheme(theme) ? theme : DEFAULT_THEME; }
export function normalizeDensity(density) { return isValidDensity(density) ? density : DEFAULT_DENSITY; }

// Tokens obrigatórios desta etapa representam cores/superfícies. Em produção
// eles são lidos já resolvidos por getComputedStyle; a aceitação de var() é
// útil para validar a folha de tema antes de ela ser aplicada no documento.
export function isValidThemeColor(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  if (normalized.startsWith("var(")) return true;
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") return CSS.supports("color", normalized);
  return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|color\()/i.test(normalized);
}

export function validateThemeTokens(readToken) {
  const values = REQUIRED_THEME_TOKENS.map(token => [token, String(readToken(token) || "").trim()]);
  const missing = values.filter(([, value]) => !value).map(([token]) => token);
  const invalid = values.filter(([, value]) => value && !isValidThemeColor(value)).map(([token]) => token);
  return { valid: missing.length === 0 && invalid.length === 0, missing, invalid };
}
