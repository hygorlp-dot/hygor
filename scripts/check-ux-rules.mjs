// Regras de UX/UI (docs/REGRAS-UX-UI.md) que dá para medir sem abrir a tela.
// Funciona como catraca: o legado existente fica registrado na linha de base e nenhuma
// alteração pode aumentar a contagem. Quando a contagem cair, rode com --update.
import {readFileSync, writeFileSync, readdirSync, statSync} from "node:fs";
import {join, relative, sep} from "node:path";
import {fileURLToPath} from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const baseFile = join(raiz, "scripts", "ux-rules-baseline.json");
const posix = p => p.split(sep).join("/");

function arquivos(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) { if (!["node_modules", "dist"].includes(nome)) arquivos(p, out); }
    else out.push(p);
  }
  return out;
}

const telas = arquivos(join(raiz, "src")).map(p => posix(relative(raiz, p)))
  .filter(p => !/\.test\.|\.spec\.|\/test\//.test(p));
const ehCssDeTela = p => p.endsWith(".css") && !/\/(themes|tokens)\/|print/.test(p);
const ehCodigo = p => /\.(jsx?|tsx?)$/.test(p);

const regras = {
  // 1.1 Só tokens de tema: cor fixa em CSS de tela quebra o tema Noite.
  "cor-fixa-em-css-de-tela": {arquivos: telas.filter(ehCssDeTela), padrao: /(?<![-\w])(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?)\s*:[^;{}]*?(#[0-9a-fA-F]{3,8}\b|rgba?\(|\bwhite\b)/g},
  // 3.1 Plural de verdade: use contar(n, "singular", "plural").
  "plural-com-parenteses": {arquivos: telas.filter(ehCodigo), padrao: /[A-Za-zÀ-ú]\(s\)/g},
  // 3.1 contar() recebe número, nunca texto já formatado (fmt, fmtCompact, count, toFixed): Number("10,5") é NaN.
  "contar-com-texto-formatado": {arquivos: telas.filter(ehCodigo), padrao: /contar(?:Decimal)?\((?:fmt\w*|count|String)\(|contar(?:Decimal)?\([^,()]*\.toFixed\(/g},
  // 2.1 Formato brasileiro: percentual com toFixed sai com ponto decimal.
  "percentual-com-ponto": {arquivos: telas.filter(ehCodigo), padrao: /toFixed\(\d\)\s*\}?\s*%|toFixed\(\d\)\s*\+\s*["'`]%/g},
};

const contagem = {};
for (const [nome, {arquivos: lista, padrao}] of Object.entries(regras)) {
  const porArquivo = {};
  for (const p of lista) {
    const n = (readFileSync(join(raiz, p), "utf8").match(padrao) || []).length;
    if (n) porArquivo[p] = n;
  }
  contagem[nome] = porArquivo;
}

if (process.argv.includes("--update")) {
  writeFileSync(baseFile, JSON.stringify(contagem, null, 2) + "\n");
  console.log("Linha de base das regras de UX/UI atualizada.");
  process.exit(0);
}

const base = JSON.parse(readFileSync(baseFile, "utf8"));
const falhas = [];
let caiu = false;
for (const nome of Object.keys(regras)) {
  const atual = contagem[nome], antes = base[nome] || {};
  for (const [p, n] of Object.entries(atual)) {
    if (n > (antes[p] || 0)) falhas.push(`${nome}: ${p} tem ${n} (linha de base ${antes[p] || 0})`);
  }
  for (const [p, n] of Object.entries(antes)) if ((atual[p] || 0) < n) caiu = true;
}
if (falhas.length) {
  console.error("Regras de UX/UI (docs/REGRAS-UX-UI.md): a contagem subiu.\n  " + falhas.join("\n  "));
  console.error("Use tokens de tema, contar(...) e pct1/Intl pt-BR em vez de cor fixa, \"(s)\" e toFixed(...)%.");
  process.exit(1);
}
const total = Object.values(contagem).reduce((s, porArquivo) => s + Object.values(porArquivo).reduce((a, b) => a + b, 0), 0);
console.log(`Regras de UX/UI: sem aumento (${total} ocorrências de legado registradas).${caiu ? " A contagem caiu: rode node scripts/check-ux-rules.mjs --update." : ""}`);
