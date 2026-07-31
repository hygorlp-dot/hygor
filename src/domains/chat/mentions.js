// O composer do chat é um <input> simples, sem rich text: uma @menção não é
// um token estruturado, é texto puro "@Nome". Por isso resolvemos por nome
// mais longo primeiro ("Ana Paula" antes de "Ana") ao enviar, senão "@Ana
// Paula" marcaria os dois usuários quando só um foi digitado.
export function resolveMentionsInText(text, candidateUsers) {
  let remaining = String(text || "");
  const found = [];
  [...(candidateUsers || [])]
    .sort((a, b) => String(b.nome || "").length - String(a.nome || "").length)
    .forEach(user => {
      const target = `@${user.nome}`;
      if (user.nome && remaining.includes(target)) {
        found.push({ id: user.id, nome: user.nome });
        remaining = remaining.split(target).join(" ".repeat(target.length));
      }
    });
  return found;
}

export function splitMentionText(text, mentions) {
  const value = String(text || "");
  const names = new Set((mentions || []).map(mention => String(mention?.nome || "")).filter(Boolean));
  if (!value || !names.size) return [{ text: value, mentioned: false }];
  const escaped = [...names]
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  const parts = value.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
  return parts.filter(Boolean).map(part => ({
    text: part,
    mentioned: part.startsWith("@") && names.has(part.slice(1)),
  }));
}
