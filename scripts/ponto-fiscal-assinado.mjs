#!/usr/bin/env node
// Emissão offline privada: não lê .env, não consulta banco, não altera a origem.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emitirDocumentoFiscal } from "../server/ponto-eletronico/fiscal/emissao.js";
import { criarAssinadorLocal } from "../server/ponto-eletronico/fiscal/assinador-local.js";
import { comprovanteParaAssinaturaHtml } from "../server/ponto-eletronico/fiscal/pdf.js";
import { exigir, sha256 } from "../server/ponto-eletronico/fiscal/campos.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf("--" + name); exigir(i >= 0 && args[i + 1] && !args[i + 1].startsWith("--"), "ARGUMENTO_OBRIGATORIO", name); return args[i + 1]; };
async function main() {
  const input = path.resolve(arg("entrada")), dir = path.resolve(arg("saida")), tipo = arg("tipo");
  exigir(["afd", "aej", "comprovante"].includes(tipo), "EXPORTACAO_INVALIDA");
  const raw = await readFile(input), snapshotHash = sha256(raw), snapshot = JSON.parse(raw);
  const renderer = async model => {
    const { createServer } = await import("vite");
    const vite = await createServer({ root, cacheDir: path.join(root, "tmp/ponto-fiscal/vite"), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
    let html;
    try { const { marcellReportHtml } = await vite.ssrLoadModule("/src/reports/marcell-report.js"); html = marcellReportHtml(comprovanteParaAssinaturaHtml(model)); }
    finally { await vite.close(); }
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage(); await page.route("**/*", route => route.abort());
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(async () => { await window.__marcellReportReady; await document.fonts.ready; });
      return await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
    } finally { await browser.close(); }
  };
  const options = { tipo, de: arg("de"), ate: arg("ate"), geradoEm: new Date().toISOString(), ...(tipo === "comprovante" ? { eventId: arg("evento") } : {}) };
  const output = await emitirDocumentoFiscal(snapshot, options, {
    renderizarPdf: renderer,
    assinarEValidar: criarAssinadorLocal({ python: process.env.PONTO_ASSINATURA_PYTHON }),
  });
  exigir(sha256(await readFile(input)) === snapshotHash, "ORIGEM_ALTERADA_DURANTE_EMISSAO");
  // Diretório novo e exclusivo impede sobrescrita e pacotes parcialmente
  // misturados com uma emissão anterior. Nada é gravado antes da validação.
  await mkdir(dir);
  await writeFile(path.join(dir, output.nome), output.bytes, { flag: "wx", mode: 0o600 });
  if (output.assinaturaDestacada) await writeFile(path.join(dir, output.assinaturaDestacada.nome), output.assinaturaDestacada.bytes, { flag: "wx", mode: 0o600 });
  await writeFile(path.join(dir, "manifesto.json"), JSON.stringify({ ...output.manifesto, snapshotSha256: snapshotHash }, null, 2), { flag: "wx", mode: 0o600 });
  process.stdout.write("Documento assinado e validado. A conformidade global do sistema depende das demais evidências.\n");
}
main().catch(error => { process.stderr.write("Emissão bloqueada: " + (error.codigo || "FALHA_EMISSAO_PRIVADA") + ". Nenhuma batida ou pagamento alterado.\n"); process.exitCode = 1; });
