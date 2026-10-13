// Confere o APK FINAL (depois do merge de manifestos e da assinatura) - o que
// o verificar-prebuild não vê. Não instala nada e não envia nada.
//
//   node scripts/verificar-apk.mjs <arquivo.apk> --build-tools <pasta com aapt e lib/apksigner.jar> [--esperado homologacao|producao]
//     [--atualiza <apk da versão anterior>]  (cenário de atualização: mesmo pacote e certificado, versionCode maior)
//
// Mostra: SHA-256 do arquivo, pacote, versionCode, permissões efetivas (lista
// PERMITIDA), assinatura (apksigner) e fingerprint do certificado, e o
// ambiente EMBUTIDO (assets/app.config: ambiente, servidor, commit). Classifica:
//   - homologação apontando para a produção, ou ambiente que não é o
//     esperado: BLOQUEADO PARA PAREAMENTO DE HOMOLOGAÇÃO;
//   - permissão fora da lista ou assinatura que não confere: REPROVADO.
// Saída 0 = aprovado para o uso esperado; 1 = reprovado/bloqueado; 2 = erro de uso.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const { ehHostDeProducao, SUFIXO_PACOTE_HOMOLOGACAO } = createRequire(import.meta.url)("../config/ambiente.js");
const valor = nome => { const i = process.argv.indexOf(`--${nome}`); return i >= 0 ? process.argv[i + 1] : null; };
const apk = process.argv[2], pasta = valor("build-tools"), esperado = valor("esperado") || "homologacao";
if (!apk || !fs.existsSync(apk) || !pasta) { console.error("uso: verificar-apk.mjs <arquivo.apk> --build-tools <pasta> [--esperado homologacao|producao]"); process.exit(2); }
const exe = nome => [path.join(pasta, `${nome}.exe`), path.join(pasta, nome)].find(fs.existsSync);
const rodar = (bin, args) => execFileSync(bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });

// Permissões que o app pode ter no APK final (normais ou necessárias).
const PERMITIDAS = ["android.permission.CAMERA", "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.INTERNET", "android.permission.VIBRATE", "android.permission.ACCESS_NETWORK_STATE",
  "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE"];

const falhas = [], linhas = [];
const anotar = (ok, texto) => { linhas.push(`${ok ? "ok  " : "FALHA"} ${texto}`); if (!ok) falhas.push(texto); };

const sha = crypto.createHash("sha256").update(fs.readFileSync(apk)).digest("hex");
const badging = rodar(exe("aapt"), ["dump", "badging", apk]);
const pacote = (badging.match(/package: name='([^']+)'/) || [])[1];
const versionCode = (badging.match(/versionCode='(\d+)'/) || [])[1];
const permissoes = [...rodar(exe("aapt"), ["dump", "permissions", apk]).matchAll(/uses-permission: name='([^']+)'/g)].map(m => m[1]);
for (const p of permissoes) {
  const propria = p === `${pacote}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`;   // gerada pelo AndroidX, nível assinatura
  anotar(PERMITIDAS.includes(p) || propria, `permissão ${p}`);
}

let certificado = "", assinaturaOk = false;
try {
  const saida = rodar("java", ["-jar", path.join(pasta, "lib", "apksigner.jar"), "verify", "--verbose", "--print-certs", apk]);
  assinaturaOk = /^Verifies$/m.test(saida);
  certificado = (saida.match(/certificate SHA-256 digest: ([0-9a-f]{64})/) || [])[1] || "";
} catch (e) { linhas.push(`FALHA apksigner: ${String(e.stderr || e.message).split("\n")[0]}`); }
anotar(assinaturaOk, "assinatura confere (apksigner verify)");

// Configuração embutida (expo-constants): assets/app.config dentro do APK (zip).
let config = null;
for (const cmd of [["tar", ["-xOf", apk, "assets/app.config"]], ["unzip", ["-p", apk, "assets/app.config"]]]) {
  try { config = JSON.parse(rodar(cmd[0], cmd[1])); break; } catch { /* tenta o próximo extrator */ }
}
const extra = config?.extra || {};
let host = "";
try { host = new URL(extra.apiUrl).host; } catch { host = ""; }
anotar(!!config, "configuração embutida (assets/app.config) lida");

// --atualiza <apk anterior>: cenário 2 da homologação (instalar a versão nova
// por cima). O Android só aceita com o MESMO pacote e o MESMO certificado, e a
// versão nova precisa de versionCode maior.
const anterior = valor("atualiza");
if (anterior) {
  if (!fs.existsSync(anterior)) { console.error("--atualiza: APK anterior não encontrado"); process.exit(2); }
  const b = rodar(exe("aapt"), ["dump", "badging", anterior]);
  const pacoteAnterior = (b.match(/package: name='([^']+)'/) || [])[1];
  const versionCodeAnterior = (b.match(/versionCode='(\d+)'/) || [])[1];
  let certificadoAnterior = "";
  try {
    certificadoAnterior = (rodar("java", ["-jar", path.join(pasta, "lib", "apksigner.jar"), "verify", "--print-certs", anterior])
      .match(/certificate SHA-256 digest: ([0-9a-f]{64})/) || [])[1] || "";
  } catch { certificadoAnterior = ""; }
  anotar(!!pacote && pacote === pacoteAnterior, `atualização: mesmo pacote da versão anterior (${pacoteAnterior || "?"})`);
  anotar(Number(versionCode) > Number(versionCodeAnterior), `atualização: versionCode ${versionCode} > ${versionCodeAnterior || "?"} da anterior`);
  anotar(!!certificado && certificado === certificadoAnterior, "atualização: mesmo certificado de assinatura da anterior (senão o Android recusa instalar por cima)");
}
let classificacao;
if (extra.ambiente !== esperado) classificacao = `BLOQUEADO PARA PAREAMENTO DE ${esperado.toUpperCase()} (ambiente embutido: ${extra.ambiente || "?"})`;
else if (esperado === "homologacao" && (ehHostDeProducao(host) || !pacote?.endsWith(SUFIXO_PACOTE_HOMOLOGACAO))) classificacao = "BLOQUEADO PARA PAREAMENTO DE HOMOLOGAÇÃO (servidor ou pacote de produção)";
else if (falhas.length) classificacao = "REPROVADO (permissão, assinatura ou atualização)";
else classificacao = `APROVADO PARA ${esperado.toUpperCase()}`;

console.log(`APK: ${path.basename(apk)}`);
console.log(`  SHA-256 do arquivo: ${sha}`);
console.log(`  pacote ${pacote}, versionCode ${versionCode}, certificado SHA-256 ${certificado || "?"}`);
console.log(`  embutido: ambiente ${extra.ambiente || "?"}, servidor ${host || "?"}${ehHostDeProducao(host) ? " (PRODUÇÃO)" : ""}, commit ${extra.commit || "?"}`);
for (const l of linhas) console.log(`  ${l}`);
console.log(`CLASSIFICAÇÃO: ${classificacao}`);
process.exitCode = classificacao.startsWith("APROVADO") ? 0 : 1;
