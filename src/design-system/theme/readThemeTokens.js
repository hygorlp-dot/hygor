export function readThemeTokens() {
  const styles = typeof window === "undefined" ? null : window.getComputedStyle(document.documentElement);
  const read = token => styles?.getPropertyValue(token).trim() || "";
  return Object.freeze({
    card: read("--arcd-surface-card"), surface: read("--arcd-surface-muted"), page: read("--arcd-surface-page"),
    text: read("--arcd-text-primary"), muted: read("--arcd-text-secondary"), border: read("--arcd-border-default"),
    line: read("--arcd-border-subtle"), yellow: read("--arcd-action-primary"), green: read("--arcd-success-text"),
    red: read("--arcd-danger-text"), orange: read("--arcd-warning-text"), blue: read("--arcd-info-text"),
  });
}
