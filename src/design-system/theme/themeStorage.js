export const THEME_STORAGE_KEYS = Object.freeze({ theme: "arcd-theme", density: "arcd-density" });

function storage() { return typeof window === "undefined" ? null : window.localStorage; }

export function readThemePreference(key) {
  try { return storage()?.getItem(key) || ""; } catch { return ""; }
}

export function writeThemePreference(key, value) {
  try { storage()?.setItem(key, value); } catch { /* preferência não é crítica para a operação */ }
}
