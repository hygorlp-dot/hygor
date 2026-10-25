#!/usr/bin/env node
// Registra fontes móveis e dependências para associar um APK compilado com
// árvore modificada ao commit que vier a conter exatamente esses arquivos.
// --conferir manifesto.json compara o registro com o checkout, sem recompilar.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ = path.resolve(APP, "../..");
const arg = nome => { const i = process.argv.indexOf(`--${nome}`); return i < 0 ? "" : process.argv[i + 1] || ""; };
const sha = value => createHash("sha256").update(value).digest("hex");
if (arg("conferir")) {
  const anterior = JSON.parse(readFileSync(arg("conferir"), "utf8"));
  const diferentes = anterior.arquivos.filter(item => !existsSync(path.join(RAIZ, item.arquivo)) || sha(readFileSync(path.join(RAIZ, item.arquivo))) !== item.sha256);
  if (diferentes.length) {
    process.stderr.write(`Fontes divergentes: ${diferentes.map(item => item.arquivo).join(", ")}\n`);
    process.exit(1);
  }
  process.stdout.write(`Fontes móveis conferidas: ${anterior.arquivos.length} arquivos; SHA256 ${anterior.fontesSha256}.\n`);
} else {
  const saida = arg("saida");
  if (!saida) throw new Error("Informe --saida manifesto.json.");
  const listados = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: RAIZ, encoding: "utf8" }).split("\0").filter(Boolean);
  const selecionados = new Set(listados.filter(arquivo => arquivo.startsWith("apps/ponto-obra/")
    && !/(^|\/)(docs|quality|scripts)(\/|$)/.test(arquivo)
    && !/\.(md|test\.[^/]+)$/.test(arquivo)
    && !/test-helper\./.test(arquivo)
    && !/\/(AGENTS|CLAUDE)\./.test(arquivo)));
  // Os imports locais compartilhados também participam do build do celular.
  const fila = [...selecionados];
  for (let i = 0; i < fila.length; i++) {
    const arquivo = fila[i];
    if (!/\.[cm]?[jt]sx?$/.test(arquivo)) continue;
    const fonte = readFileSync(path.join(RAIZ, arquivo), "utf8");
    for (const match of fonte.matchAll(/(?:from\s+|require\(\s*)["'](\.[^"']+)["']/g)) {
      const base = path.resolve(RAIZ, path.dirname(arquivo), match[1]);
      const destino = [base, `${base}.js`, `${base}.jsx`, `${base}.ts`, path.join(base, "index.js")].find(item => existsSync(item) && statSync(item).isFile());
      if (!destino || !destino.startsWith(RAIZ + path.sep) || destino.includes(`${path.sep}node_modules${path.sep}`)) continue;
      const rel = path.relative(RAIZ, destino);
      if (!selecionados.has(rel)) { selecionados.add(rel); fila.push(rel); }
    }
  }
  // A resolução Metro pode consultar dependências da raiz do monorepo.
  for (const arquivo of ["package.json", "package-lock.json"]) selecionados.add(arquivo);
  const arquivos = [...selecionados].sort().filter(arquivo => existsSync(path.join(RAIZ, arquivo)) && statSync(path.join(RAIZ, arquivo)).isFile())
    .map(arquivo => ({ arquivo, sha256: sha(readFileSync(path.join(RAIZ, arquivo))) }));
  const manifesto = {
    geradoEm: new Date().toISOString(), criterio: "Fontes, configurações, assets, módulo nativo e lockfiles; testes, documentação e scripts de operação excluídos.",
    commitBase: execFileSync("git", ["rev-parse", "HEAD"], { cwd: RAIZ, encoding: "utf8" }).trim(),
    fontesSha256: sha(JSON.stringify(arquivos)), arquivos,
  };
  writeFileSync(saida, JSON.stringify(manifesto, null, 2) + "\n");
  process.stdout.write(`Registro móvel criado: ${arquivos.length} arquivos; SHA256 ${manifesto.fontesSha256}.\n`);
}
