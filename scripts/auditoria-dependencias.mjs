// Portão de auditoria de dependências (substitui o `npm audit --audit-level=high`
// puro na CI, sem afrouxar: todo advisory high/critical bloqueia, exceto os de
// scripts/auditoria-excecoes.json que ainda não têm versão corrigida publicada).
// Regras e testes: scripts/auditoria-dependencias-regras.mjs.
//
//   node scripts/auditoria-dependencias.mjs                 # raiz
//   node scripts/auditoria-dependencias.mjs apps/ponto-obra # app Android
//
// Sai com 1 se algo bloquear. Imprime TODOS os advisories (também os
// moderados), para nada ficar escondido.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atingidosPor, avaliarAuditoria } from "./auditoria-dependencias-regras.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const escopo = (process.argv[2] || ".").replace(/\\/g, "/").replace(/\/$/, "") || ".";
const pasta = path.resolve(raiz, escopo);
const naCi = process.env.GITHUB_ACTIONS === "true";
// Texto do relatório do npm (título, faixa) é dado de fora: sempre numa linha
// só, para nunca começar uma linha "::comando::" no log do GitHub Actions.
const umaLinha = s => String(s ?? "").replace(/[\r\n]+/g, " ");
// Mensagem de anotação (::warning/::error) escapada como o Actions pede.
const anotacao = s => umaLinha(s).replace(/%/g, "%25");
const anotar = (tipo, titulo, msg) => `::${tipo} title=${titulo}::${anotacao(msg)}`;

// Comandos fixos; o único dado variável é o nome do pacote, que vem de
// scripts/auditoria-excecoes.json e é conferido (regex) antes de ir para a
// linha de comando. Timeout para o registro lento não segurar o job.
function npmJson(comando) {
  try {
    return JSON.parse(execSync(comando, { cwd: pasta, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 }));
  } catch (erro) {
    // `npm audit` sai com código != 0 quando acha vulnerabilidade: o JSON vem no stdout.
    if (erro.stdout) { try { return JSON.parse(erro.stdout); } catch { /* cai no null */ } }
    return null;
  }
}

const relatorio = npmJson("npm audit --json");
const excecoes = JSON.parse(readFileSync(path.join(raiz, "scripts/auditoria-excecoes.json"), "utf8")).excecoes;

const versoesPublicadas = {};
for (const pacote of new Set(excecoes.filter(e => (e.escopos || []).includes(escopo)).map(e => e.pacote))) {
  if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(pacote)) continue;
  const v = npmJson(`npm view ${pacote} versions --json`);
  if (Array.isArray(v)) versoesPublicadas[pacote] = v;
}

const hoje = new Date().toISOString().slice(0, 10);
const r = avaliarAuditoria({ relatorio, excecoes, escopo, hoje, versoesPublicadas });

console.log(`Auditoria de dependências - escopo "${escopo}" - ${hoje}`);
console.log(`Totais do npm audit: ${JSON.stringify(relatorio?.metadata?.vulnerabilities || {})}`);
for (const a of r.advisories) console.log(umaLinha(`  ${a.severidade.padEnd(8)} ${a.pacote.padEnd(26)} ${a.ghsa}  faixa ${a.faixa}  ${a.titulo}`));
for (const a of r.advisories) if (["high", "critical"].includes(a.severidade)) console.log(`  ${a.pacote} atinge: ${atingidosPor(relatorio, a.pacote).join(", ") || "-"}`);
for (const e of r.excecoesAplicadas) {
  const msg = `EXCEÇÃO FORMAL: ${e.pacote} ${e.ghsa} (${e.severidade}) sem versão corrigida publicada (última vulnerável: ${e.ultimaVulneravel}); revisar até ${e.revisarAte}. Ver scripts/auditoria-excecoes.json`;
  console.log(naCi ? anotar("warning", "Vulnerabilidade sem correção publicada", msg) : `AVISO  ${umaLinha(msg)}`);
}
for (const e of r.excecoesSemUso) console.log(naCi ? anotar("warning", "Exceção sem uso", `${e} não aparece mais no escopo "${escopo}" - remover da lista`) : `AVISO  exceção sem uso no escopo "${escopo}": ${e}`);
if (r.falhas.length) {
  for (const f of r.falhas) console.error(naCi ? anotar("error", "Auditoria de dependências", f) : `FALHA  ${umaLinha(f)}`);
  console.error(`\n${r.falhas.length} problema(s) bloqueante(s).`);
  process.exit(1);
}
console.log(`\nNenhum advisory high/critical sem tratamento (${r.excecoesAplicadas.length} exceção(ões) formal(is) em vigor).`);
