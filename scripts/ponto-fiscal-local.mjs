#!/usr/bin/env node
// Ferramenta offline: não lê .env, não conecta à API e não grava no banco.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditarSnapshot } from "../server/ponto-eletronico/fiscal/auditoria.js";
import { exportarSnapshot, comprovanteHtml } from "../server/ponto-eletronico/fiscal/servico.js";
import { exigir, sha256 } from "../server/ponto-eletronico/fiscal/campos.js";

const args = process.argv.slice(2), arg = name => args[args.indexOf("--" + name) + 1];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function main() {
  exigir(args.includes("--entrada") && args.includes("--saida") && args.includes("--tipo"), "USO: --entrada snapshot.json --saida pasta --tipo auditoria|afd|aej|comprovante --de AAAA-MM-DD --ate AAAA-MM-DD [--evento ID]");
  const tipo = arg("tipo"), dir = path.resolve(arg("saida")), input = path.resolve(arg("entrada"));
  exigir(["auditoria", "afd", "aej", "comprovante"].includes(tipo), "EXPORTACAO_INVALIDA");
  const raw = await readFile(input), before = sha256(raw), s = JSON.parse(raw.toString("utf8"));
  await mkdir(dir, { recursive: true });
  const audit = await auditarSnapshot(s);
  const auditFile = path.join(dir, "auditoria-integridade.json");
  await writeFile(auditFile, JSON.stringify({ ...audit, snapshotSha256: before }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  if (tipo === "auditoria") {
    process.stdout.write("Auditoria gerada. Integridade: " + (audit.integridadeValida ? "aprovada" : "reprovada") + ". Pendências: " + audit.pendencias.length + ".\n");
    if (!audit.integridadeValida) process.exitCode = 2;
    return;
  }
  const result = await exportarSnapshot(s, { tipo, de: arg("de"), ate: arg("ate"), eventId: arg("evento"), geradoEm: new Date().toISOString() });
  let name, bytes, manifest;
  if (result.arquivo) {
    ({ bytes, ...manifest } = result.arquivo);
    name = "RASCUNHO_" + result.arquivo.nome;
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({ root, cacheDir: path.join(root, "tmp/ponto-fiscal/vite"), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
    let html;
    try { const { marcellReportHtml } = await vite.ssrLoadModule("/src/reports/marcell-report.js"); html = marcellReportHtml(comprovanteHtml(result.comprovante)); }
    finally { await vite.close(); }
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      // Relatório autossuficiente; nenhum conteúdo remoto deve ser requisitado.
      await page.route("**/*", route => route.abort());
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(async () => { await window.__marcellReportReady; await document.fonts.ready; });
      bytes = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
      await writeFile(path.join(dir, "comprovante-rascunho.html"), html, { flag: "wx", mode: 0o600 });
    } finally { await browser.close(); }
    name = "comprovante-rascunho.pdf";
    manifest = { status: "rascunho_nao_assinado", assinatura: { padrao: "PAdES", verificada: false }, eventId: result.comprovante.eventId, pendencias: result.comprovante.pendencias };
  }
  exigir(sha256(await readFile(input)) === before, "SNAPSHOT_ALTERADO_DURANTE_GERACAO");
  await writeFile(path.join(dir, name), bytes, { flag: "wx", mode: 0o600 });
  await writeFile(path.join(dir, name + ".json"), JSON.stringify({ ...manifest, nome: name, sha256: sha256(bytes), snapshotSha256: before, somenteLeitura: true, conforme: false }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write("Documento gerado localmente: " + name + ". Sem assinatura ICP-Brasil; não utilizar como documento oficial.\n");
}
main().catch(error => { process.stderr.write("Geração interrompida: " + (error.codigo || error.message) + ". Nenhum dado de ponto ou pagamento foi alterado.\n"); process.exitCode = 1; });
