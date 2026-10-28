// Por usuário e por aba do navegador: recarregar não perde a seção e outra
// sessão não herda uma tela para a qual não tem permissão.
const keyFor = userId => `arcd-section:${userId}`;

export function restoreSection(userId, allowedTabs, storage) {
  const fallback = allowedTabs[0] || "home";
  if (!userId) return fallback;
  try {
    const saved = (storage ?? globalThis.sessionStorage)?.getItem(keyFor(userId));
    return allowedTabs.includes(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function rememberSection(userId, tab, allowedTabs, storage) {
  if (!userId || !allowedTabs.includes(tab)) return;
  try { (storage ?? globalThis.sessionStorage)?.setItem(keyFor(userId), tab); } catch { /* Storage indisponível não impede navegação. */ }
}
