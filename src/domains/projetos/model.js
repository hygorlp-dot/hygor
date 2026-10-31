export const PROJECT_STAGES = ["Levantamento", "Estudo preliminar", "Anteprojeto", "Executivo", "Concluído"];
export const PROJECT_DISCIPLINES = ["Arquitetura", "Estrutura", "Hidrossanitário", "Elétrica", "Compatibilização", "Outros"];
export const PROJECT_STATUSES = { ativo: "Em andamento", concluido: "Concluído", arquivado: "Arquivado" };
export const REVISION_STATUSES = { pendente: "Aguardando revisão", aprovada: "Aprovada", ajustes: "Ajustes solicitados" };

export function safeProjectUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && url.href.length <= 2048 ? url.href : "";
  } catch { return ""; }
}

export function sessionSeconds(session, now = Date.now()) {
  if (session.adjustedSeconds != null) return Math.max(0, Number(session.adjustedSeconds) || 0);
  const end = session.endedAt ? Date.parse(session.endedAt) : Number(now);
  return Math.max(0, Math.floor((end - Date.parse(session.startedAt)) / 1000)) || 0;
}

export const projectSeconds = (project, now) => (project.sessions || []).reduce((total, session) => total + sessionSeconds(session, now), 0);
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(total / 3600)).padStart(2, "0")}:${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function activeProjectSession(projects, userId) {
  for (const project of projects || []) {
    const session = (project.sessions || []).find(item => item.userId === userId && !item.endedAt);
    if (session) return { project, session };
  }
  return null;
}
