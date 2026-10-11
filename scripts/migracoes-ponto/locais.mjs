// Identidade de banco e checagens de pasta das CLIs do ponto (livro,
// backup e restauração). Nunca devolve nem imprime senha ou URL.
import fs from "node:fs";
import path from "node:path";

// usuario@host:porta/banco. No pooler do Supabase o host é COMPARTILHADO
// entre projetos; o projeto vem no usuário (postgres.<ref>) - por isso o
// usuário entra na identidade. Erro de URL não repete o valor (pode ter senha).
export function identidadeBanco(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error("URL do banco inválida (o valor não é exibido)"); }
  const banco = decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres";
  return `${decodeURIComponent(u.username || "postgres")}@${u.hostname}:${u.port || "5432"}/${banco}`;
}
export const hostDe = url => { try { return new URL(url).hostname; } catch { throw new Error("URL do banco inválida (o valor não é exibido)"); } };
export const hostLocal = host => /^(localhost|127\.0\.0\.1|::1|\[::1\])$/.test(String(host));

// Caminho real (resolve links/junções do que já existe) e, no Windows, sem
// diferença de maiúsculas: "C:\USERS\...\repo\x" é dentro do repositório.
function real(alvo) {
  let atual = path.resolve(alvo); const resto = [];
  while (!fs.existsSync(atual)) { const pai = path.dirname(atual); if (pai === atual) break; resto.unshift(path.basename(atual)); atual = pai; }
  const r = path.join(fs.existsSync(atual) ? fs.realpathSync.native(atual) : atual, ...resto);
  return process.platform === "win32" ? r.toLowerCase() : r;
}
export function dentroDe(raiz, alvo) {
  const r = real(raiz), a = real(alvo);
  return a === r || a.startsWith(r.endsWith(path.sep) ? r : r + path.sep);
}
// Pastas sincronizadas com a nuvem (OneDrive): nada em CLARO pode ir para lá
// (fotos biométricas extraídas). O pacote cifrado pode.
export function pastaSincronizada(alvo) {
  const nuvens = [process.env.OneDrive, process.env.OneDriveCommercial, process.env.OneDriveConsumer].filter(Boolean);
  return nuvens.some(n => dentroDe(n, alvo)) || /[\\/]onedrive[^\\/]*[\\/]/i.test(`${path.resolve(alvo)}${path.sep}`);
}

// Marcador que o operador põe no banco DESCARTÁVEL antes de restaurar:
//   comment on database <banco> is 'arcd-ponto-descartavel';
export const MARCADOR_DESCARTAVEL = "arcd-ponto-descartavel";
