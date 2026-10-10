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
import { avaliarAuditoria } from "./auditoria-dependencias-regras.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const escopo = (process.argv[2] || ".").replace(/\\/g, "/").replace(/\/$/, "") || ".";
const pasta = path.resolve(raiz, escopo);
const naCi = process.env.GITHUB_ACTIONS === "true";

// Comandos fixos; o único dado variável é o nome do pacote, que vem do
// relatório do npm e é conferido antes de ir para a linha de comando.
function npmJson(comando) {
  try {
    return JSON.parse(execSync(comando, { cwd: pasta, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }));
  } catch (erro) {
    // `npm audit` sai com código != 0 quando acha vulnerabilidade: o JSON vem no stdout.
    if (erro.stdout) { try { return JSON.parse(erro.stdout); } catch { /* cai no null */ } }
    return null;
  }
}

const relatorio = npmJson("npm audit --json");
const excecoes = JSON.parse(readFileSync(path.join(raiz, "scripts/auditoria-excecoes.json"), "utf8")).excecoes;

const ultimaVersao = {};
for (const pacote of new Set(excecoes.filter(e => (e.escopos || []).includes(escopo)).map(e => e.pacote))) {
  if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(pacote)) continue;
  const v = npmJson(`npm view ${pacote} version --json`);
  if (typeof v === "string") ultimaVersao[pacote] = v;
}

const hoje = new Date().toISOString().slice(0, 10);
const r = avaliarAuditoria({ relatorio, excecoes, escopo, hoje, ultimaVersao });

console.log(`Auditoria de dependências - escopo "${escopo}" - ${hoje}`);
console.log(`Totais do npm audit: ${JSON.stringify(relatorio?.metadata?.vulnerabilities || {})}`);
for (const a of r.advisories) console.log(`  ${a.severidade.padEnd(8)} ${a.pacote.padEnd(26)} ${a.ghsa}  faixa ${a.faixa}  ${a.titulo}`);
for (const e of r.excecoesAplicadas) {
  const msg = `EXCEÇÃO FORMAL: ${e.pacote} ${e.ghsa} (${e.severidade}) sem versão corrigida publicada (última: ${e.ultimaVersao}); revisar até ${e.revisarAte}. Ver scripts/auditoria-excecoes.json`;
  console.log(naCi ? `::warning title=Vulnerabilidade sem correção publicada::${msg}` : `AVISO  ${msg}`);
}
for (const e of r.excecoesSemUso) console.log(naCi ? `::warning title=Exceção sem uso::${e} não aparece mais no escopo "${escopo}" - remover da lista` : `AVISO  exceção sem uso no escopo "${escopo}": ${e}`);
if (r.falhas.length) {
  for (const f of r.falhas) console.error(naCi ? `::error title=Auditoria de dependências::${f}` : `FALHA  ${f}`);
  console.error(`\n${r.falhas.length} problema(s) bloqueante(s).`);
  process.exit(1);
}
console.log(`\nNenhum advisory high/critical sem tratamento (${r.excecoesAplicadas.length} exceção(ões) formal(is) em vigor).`);
