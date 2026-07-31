export const MAX_CHAT_MENTIONS = 10;

const safeText = (value, max) => String(value || "")
  .replace(/[\x00-\x1f]/g, "")
  .slice(0, max);

export function sanitizeChatMentions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CHAT_MENTIONS)
    .map(mention => ({
      id: safeText(mention?.id, 60),
      nome: safeText(mention?.nome, 80),
    }))
    .filter(mention => mention.id && mention.nome);
}

export function sanitizeChatAttachment(value) {
  if (!value || typeof value !== "object") return null;
  const url = String(value.url || "");
  if (!/^https:\/\//.test(url) || url.length > 600) return null;
  return {
    url,
    name: safeText(value.name, 150) || "arquivo",
    type: safeText(value.type, 80),
    size: Number.isFinite(Number(value.size)) ? Math.max(0, Number(value.size)) : 0,
  };
}

export function deletedChatMessage(message, { at, by }) {
  return {
    ...message,
    text: "",
    mentions: [],
    attachment: null,
    deletedAt: at,
    deletedBy: by,
  };
}
