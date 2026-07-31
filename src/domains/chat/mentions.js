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
