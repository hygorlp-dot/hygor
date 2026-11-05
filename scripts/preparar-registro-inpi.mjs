#!/usr/bin/env node
// Congela material técnico; não envia pedido, não paga GRU e não registra o software.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf("--" + name); if (i < 0 || !args[i + 1] || args[i + 1].startsWith("--")) throw Error("ARGUMENTO_OBRIGATORIO"); return args[i + 1]; };
async function main() {
  const nome = arg("nome"), versao = arg("versao"), dir = path.resolve(arg("saida"));
  const git = (...commands) => execFileSync("git", commands, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 10_000_000 });
  const files = [...new Set(git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean))]
    .filter(f => /^(src|server|api|apps\/ponto-obra\/(?:src|modules|scripts)|scripts)\//.test(f) || /^apps\/ponto-obra\/(?:App|index|app.config|metro.config)\.js$/.test(f))
    .filter(f => /\.(?:js|jsx|ts|tsx|mjs|py|sql|kt|gradle|xml)$/.test(f) && !/(?:^|\/)(?:tmp|output|node_modules|__pycache__)\//.test(f)).sort();
  const chunks = [], sources = [];
  for (const file of files) {
    const resolved = path.resolve(root, file);
    if (!resolved.startsWith(root + path.sep)) throw Error("CAMINHO_INVALIDO");
    const bytes = await readFile(resolved);
    chunks.push(Buffer.from(file + "\n" + bytes.length + "\n"), bytes, Buffer.from("\n"));
    sources.push({ arquivo: file, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const material = Buffer.concat(chunks), sha512 = createHash("sha512").update(material).digest("hex");
  await mkdir(dir);
  await writeFile(path.join(dir, "material-tecnico.bin"), material, { flag: "wx", mode: 0o600 });
  await writeFile(path.join(dir, "manifesto-inpi.json"), JSON.stringify({ nome, versao, commitBase: git("rev-parse", "HEAD").trim(), incluiAlteracoesLocais: true,
    algoritmo: "SHA-512", hashMaterialTecnico: sha512, escopo: "Fontes web/backend e fontes nativos do checkout identificado; não é o binário APK18 nem o certificado do INPI. Este CLI produz material binário preparatório, não substitui o hash do ZIP definitivo solicitado pelo titular.", arquivos: sources,
    registroEfetuado: false, orientacao: "Conferir autoria, titularidade, dependências e escopo antes do e-Software; conservar este material exato. Qualquer alteração exige novo congelamento." }, null, 2), { flag: "wx", mode: 0o600 });
  process.stdout.write("Material local preparado: " + files.length + " fontes. Nenhum registro solicitado ao INPI.\n");
}
main().catch(() => { process.stderr.write("Preparação bloqueada; revise os argumentos e use uma pasta nova.\n"); process.exitCode = 1; });
