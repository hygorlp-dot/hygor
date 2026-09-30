#!/usr/bin/env node
// Barra no `npm run lint` as classes de erro que chegaram à produção em
// 29-30/09/2026 sem derrubar a tela (o ErrorBoundary não vê nenhuma delas):
//
// 1. handler-com-padrao: função com parâmetro padrão ligada direto num
//    evento (onClick={f}). O evento do clique chega como 1º argumento e o
//    valor padrão nunca vale - "Aprovar baseline" dizia "Orçamento não
//    encontrado" porque recebia o evento no lugar do id.
// 2. janela-noopener: window.open(..., "noopener") seguido de
//    document.write. Com noopener o navegador devolve null: a exportação do
//    cronograma abria uma aba em branco.
// 3. mojibake: texto com codificação dupla (Ã§, Ã£, â€) ou caractere de
//    substituição (U+FFFD).
// 4. simbolo-perdido: espaço duplo no meio de texto de tela/documento,
//    sinal de símbolo apagado numa conversão de codificação - a fórmula do BDI
//    saía "(1 + L)  (1  I) ]  1" (sem ÷ e −) e as áreas "m" sem o ².
//
// Exceção pontual: comentário "lint-ok: <regra>" na mesma linha.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();
const PASTAS = ["src"];

const listar = dir => readdirSync(dir).flatMap(nome => {
  const caminho = join(dir, nome);
  if (statSync(caminho).isDirectory()) return nome === "node_modules" ? [] : listar(caminho);
  return /\.(jsx?|tsx?)$/.test(nome) && !/\.(test|spec|stories)\./.test(nome) ? [caminho] : [];
});

const escaparRegex = texto => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const linhaDe = (texto, indice) => texto.slice(0, indice).split("\n").length;

// Espaço duplo que não é indentação nem alinhamento de propriedades JSX /
// objetos: só conta quando os dois lados são "texto" (letra, dígito, fecha
// parêntese, ², %) ou interpolação ${...} encostada em texto.
const LADO_ESQ = /[\p{L}\p{N})\]%²³º°]$/u;
const LADO_DIR = /^[\p{L}\p{N}($]/u;
const pareceAtributo = resto => /^[A-Za-z_$][\w$-]*\s*[=:]/.test(resto);
// O trecho está em texto que chega à tela/documento: dentro de template
// literal (crases ímpares antes, fora de ${...} aberto) ou em texto JSX
// (último ">" depois do último "{", "}" e "<", com uma tag fechando adiante).
// Código alinhado com espaços ("if (x)   y += ...") fica de fora.
const dentroDeTexto = (antes, depois) => {
  const crases = (antes.match(/(?<!\\)`/g) || []).length;
  if (crases % 2 === 1) {
    const aberto = antes.lastIndexOf("${");
    return aberto < 0 || antes.indexOf("}", aberto) >= 0;
  }
  const fechaTag = antes.lastIndexOf(">");
  const abreExpr = antes.lastIndexOf("{"), fechaExpr = antes.lastIndexOf("}");
  // texto JSX: depois de uma tag aberta e fora de {expressão} (ou depois de
  // uma {expressão} já fechada, como "{n} obra(s) com caixa")
  return fechaTag >= 0 && fechaTag > antes.lastIndexOf("<") && (abreExpr < fechaTag || fechaExpr > abreExpr) && depois.includes("<");
};

export function verificarArquivo(texto, rel) {
  const achados = [];
  const linhas = texto.split("\n");
  const ignorada = (numero, regra) => new RegExp(`lint-ok:\\s*${regra}`).test(linhas[numero - 1] || "");
  const registrar = (regra, numero, detalhe) => { if (!ignorada(numero, regra)) achados.push({ regra, arquivo: rel, linha: numero, detalhe }); };

  // 1. handler com parâmetro padrão ligado direto num evento
  const comPadrao = new Set([
    ...[...texto.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(\s*[A-Za-z_$][\w$]*\s*=\s*[^,)\s]/g)].map(m => m[1]),
    ...[...texto.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(\s*[A-Za-z_$][\w$]*\s*=\s*[^,)\s]/g)].map(m => m[1]),
  ]);
  for (const nome of comPadrao) {
    for (const m of texto.matchAll(new RegExp(String.raw`\bon[A-Z]\w*=\{` + escaparRegex(nome) + String.raw`\}`, "g"))) {
      registrar("handler-com-padrao", linhaDe(texto, m.index), `${m[0]}: o evento chega no lugar do parâmetro padrão - use on...={()=>${nome}()}`);
    }
  }

  // 2. janela aberta com noopener e escrita depois
  for (const m of texto.matchAll(/window\.open\([^)]*noopener[^)]*\)[\s\S]{0,400}?\.document\.write/g)) {
    registrar("janela-noopener", linhaDe(texto, m.index), "window.open com noopener devolve null; abra sem noopener, escreva e depois faça w.opener=null");
  }

  // 3. mojibake
  for (const m of texto.matchAll(/Ã[\u0080-¿]|Â[\u0080-¿]|â€|�/g)) {
    registrar("mojibake", linhaDe(texto, m.index), `codificação quebrada perto de ${JSON.stringify(texto.slice(Math.max(0, m.index - 12), m.index + 12))}`);
  }

  // 4. símbolo perdido: só em texto de tela/documento (template literal ou
  //    JSX), fora de comentários.
  linhas.forEach((linha, i) => {
    // 4b. separador de só espaços numa string: join("  "), +"  "+
    if (/join\(\s*(["'`]) {2,}\1\s*\)|\+\s*(["']) {2,}\2|(["']) {2,}\3\s*\+/.test(linha)) {
      registrar("simbolo-perdido", i + 1, `separador feito só de espaços em ${JSON.stringify(linha.trim().slice(0, 90))} - use " · "`);
    }
    for (const trecho of trechosSimboloPerdido(linha)) {
      registrar("simbolo-perdido", i + 1, `espaço duplo em ${JSON.stringify(linha.slice(Math.max(0, trecho.inicio - 20), trecho.fim + 20).trim())} - símbolo apagado (÷ − ² ·)?`);
    }
  });
  return achados;
}

// Posições [inicio, fim) dos espaços duplos suspeitos numa linha de código.
export function trechosSimboloPerdido(linha) {
  const recuo = linha.length - linha.replace(/^\s+/, "").length;
  const t = linha.slice(recuo);
  if (!t || /^(\/\/|\*|\/\*)/.test(t) || !/[`<>]/.test(t)) return [];
  const trechos = [];
  for (const m of t.matchAll(/ {2,}/g)) {
    const antes = t.slice(0, m.index), depois = t.slice(m.index + m[0].length);
    if (!dentroDeTexto(antes, depois)) continue;
    const esquerdaTexto = LADO_ESQ.test(antes) || /\}$/.test(antes) && /\$\{[^}]*\}$/.test(antes);
    if (!esquerdaTexto || !LADO_DIR.test(depois) || pareceAtributo(depois)) continue;
    trechos.push({ inicio: recuo + m.index, fim: recuo + m.index + m[0].length });
  }
  return trechos;
}

const ehExecucaoDireta = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (ehExecucaoDireta) {
  const arquivos = PASTAS.flatMap(p => listar(join(RAIZ, p)));
  const achados = arquivos.flatMap(caminho => verificarArquivo(readFileSync(caminho, "utf8"), relative(RAIZ, caminho).replace(/\\/g, "/")));
  if (achados.length) {
    console.error(`Armadilhas de UI encontradas (${achados.length}):`);
    for (const a of achados) console.error(`  [${a.regra}] ${a.arquivo}:${a.linha} - ${a.detalhe}`);
    console.error("Exceção pontual: comentário \"lint-ok: <regra>\" na mesma linha.");
    process.exit(1);
  }
  console.log(`Sem armadilhas de UI em ${arquivos.length} arquivos de src/.`);
}
