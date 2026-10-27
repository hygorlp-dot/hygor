#!/usr/bin/env node
// Build local: Expo prebuild + Gradle. Sem EAS, login ou créditos de nuvem.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conferirPermissoesApk } from "./permissoes-apk.mjs";

const require = createRequire(import.meta.url);
const { resolverServidor } = require("../config/ambiente.js");
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ = path.resolve(APP, "../..");
const arg = nome => { const i = process.argv.indexOf(`--${nome}`); return i < 0 ? "" : process.argv[i + 1] || ""; };
const versao = Number(arg("version-code") || process.env.PONTO_VERSION_CODE || 5);
if (!Number.isSafeInteger(versao) || versao < 5) throw new Error("version-code deve ser inteiro a partir de 5.");
const varianteHomologacao = String(process.env.PONTO_HOMOLOGACAO_VARIANT || "").trim().toLowerCase();
if (varianteHomologacao && !/^[a-z][a-z0-9]{0,15}$/.test(varianteHomologacao)) throw new Error("PONTO_HOMOLOGACAO_VARIANT inválida.");
const pacoteEsperado = `br.com.arcd.pontoobra.homologacao${varianteHomologacao ? `.${varianteHomologacao}` : ""}`;
const workers = Number(process.env.PONTO_GRADLE_WORKERS || 2);
if (![1, 2].includes(workers)) throw new Error("Use um ou dois workers Gradle neste build local.");
const servidor = resolverServidor({ ambiente: process.env.PONTO_AMBIENTE, urlEnv: process.env.PONTO_API_URL });
if (servidor.ambiente !== "homologacao" || new URL(servidor.apiUrl).hostname.endsWith(".invalid")) throw new Error("Este script só gera APK de homologação com endpoint real.");
const saida = path.resolve(arg("output") || path.join(APP, "quality-out/apk"));
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) throw new Error("Informe ANDROID_HOME com o SDK local.");
const configAssinatura = process.env.PONTO_SIGNING_FILE;
if (!configAssinatura || !existsSync(configAssinatura)) throw new Error("Informe PONTO_SIGNING_FILE com a chave privada existente. Nunca use a chave debug para distribuir.");
if (statSync(configAssinatura).mode & 0o077) throw new Error("O arquivo de assinatura precisa ter permissão 600.");
const assinatura = JSON.parse(readFileSync(configAssinatura, "utf8"));
if (![assinatura.path, assinatura.password, assinatura.alias, assinatura.keyPassword].every(v => typeof v === "string" && v.length > 0) || !existsSync(assinatura.path)) throw new Error("Configuração privada de assinatura incompleta.");

const executar = (cmd, args, opcoes = {}) => {
  const r = spawnSync(cmd, args, { cwd: APP, env, encoding: "utf8", stdio: "inherit", maxBuffer: 64 * 1024 * 1024, ...opcoes });
  if (r.status !== 0) throw new Error(`Etapa falhou: ${path.basename(cmd)} (código ${r.status ?? "indisponível"}). Confira o log; nenhum APK foi liberado.`);
  return r.stdout || "";
};
const env = {
  ...process.env, PONTO_AMBIENTE: servidor.ambiente, PONTO_API_URL: servidor.apiUrl,
  PONTO_VERSION_CODE: String(versao), PONTO_BUILD_PROFILE: "homologacao-local",
  PONTO_BUILD_TIMESTAMP: new Date().toISOString(), EXPO_NO_TELEMETRY: "1", CI: "1",
  NODE_ENV: "production",
  CMAKE_BUILD_PARALLEL_LEVEL: process.env.CMAKE_BUILD_PARALLEL_LEVEL || "2",
  PONTO_KEYSTORE_PATH: assinatura.path, PONTO_KEYSTORE_PASSWORD: assinatura.password,
  PONTO_KEY_ALIAS: assinatura.alias, PONTO_KEY_PASSWORD: assinatura.keyPassword,
};

// Só consulta pública de ambiente. Não pareia, não envia batidas ou dados pessoais.
executar(process.execPath, ["scripts/garantir-modelo-facenet.mjs"]);
process.stdout.write("Confirmando o backend isolado antes da compilação…\\n");
const inicioConsulta = new Date().toISOString();
const resposta = await fetch(servidor.apiUrl, {
  method: "POST", headers: { "content-type": "application/json" }, redirect: "error",
  body: JSON.stringify({ action: "ponto-ambiente", ambienteApp: "homologacao" }), signal: AbortSignal.timeout(30_000),
});
const confirmacao = await resposta.json().catch(() => ({}));
if (resposta.status !== 200 || confirmacao.ok !== true || confirmacao.ambiente !== "homologacao") throw new Error(`Backend não confirmou homologação (HTTP ${resposta.status}). Compilação interrompida.`);

const git = args => executar("git", args, { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] }).trim();
const commit = git(["rev-parse", "HEAD"]);
env.EAS_BUILD_GIT_COMMIT_HASH = commit;
const sujo = !!git(["status", "--porcelain"]);
const arquivos = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean).sort();
const hashFonte = createHash("sha256");
for (const arquivo of arquivos) {
  const completo = path.join(RAIZ, arquivo);
  if (!existsSync(completo) || !statSync(completo).isFile()) continue;
  hashFonte.update(arquivo + "\0").update(readFileSync(completo)).update("\0");
}
env.PONTO_SOURCE_FINGERPRINT = hashFonte.digest("hex");
env.PONTO_SOURCE_DIRTY = sujo ? "1" : "0";
const pacoteAntes = readFileSync(path.join(APP, "package.json"));
try {
  process.stdout.write("Gerando o projeto Android e conferindo módulos, SQLCipher e permissões…\n");
  executar("npx", ["--no-install", "expo", "prebuild", "--platform", "android", "--no-install"]);
  executar(process.execPath, ["scripts/verificar-prebuild.mjs"]);
  const wrapper = path.join(APP, "android/gradle/wrapper/gradle-wrapper.properties");
  let props = readFileSync(wrapper, "utf8");
  if (!props.includes("gradle-9.3.1-bin.zip")) throw new Error("Versão Gradle mudou; confira o checksum oficial antes de continuar.");
  props = props.replace(/^distributionSha256Sum=.*\n?/gm, "");
  props += "\ndistributionSha256Sum=b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06\n";
  writeFileSync(wrapper, props);
  const arquiteturas = process.env.PONTO_ANDROID_ARCHITECTURES || "arm64-v8a,armeabi-v7a,x86_64";
  if (!/^(arm64-v8a|armeabi-v7a|x86_64)(,(arm64-v8a|armeabi-v7a|x86_64))*$/.test(arquiteturas)) throw new Error("Arquiteturas Android inválidas.");
  process.stdout.write("Compilando APK release com chave exclusiva de homologação…\n");
  executar(path.join(APP, "android/gradlew"), [":app:assembleRelease", "--no-daemon", "--console=plain", `--max-workers=${workers}`, `-PreactNativeArchitectures=${arquiteturas}`], { cwd: path.join(APP, "android") });
  const apkGerado = path.join(APP, "android/app/build/outputs/apk/release/app-release.apk");
  const buildTools = path.join(sdk, "build-tools/36.0.0");
  const assinaturaPublica = executar(path.join(buildTools, "apksigner"), ["verify", "--verbose", "--print-certs", apkGerado], { stdio: ["ignore", "pipe", "pipe"] });
  const certificadoSha256 = assinaturaPublica.match(/certificate SHA-256 digest: ([a-f0-9]{64})/i)?.[1]?.toLowerCase();
  if (!certificadoSha256 || /CN=Android Debug/i.test(assinaturaPublica)) throw new Error("APK sem certificado exclusivo válido.");
  const manifesto = executar(path.join(buildTools, "aapt"), ["dump", "badging", apkGerado], { stdio: ["ignore", "pipe", "pipe"] });
  const identidade = manifesto.match(/package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/);
  if (!identidade || identidade[1] !== pacoteEsperado || Number(identidade[2]) !== versao) throw new Error("Pacote ou versão do APK não corresponde à homologação solicitada.");
  const configAndroid = JSON.parse(readFileSync(path.join(APP, "app.json"), "utf8")).expo.android;
  const permissoes = conferirPermissoesApk(
    executar(path.join(buildTools, "aapt"), ["dump", "permissions", apkGerado], { stdio: ["ignore", "pipe", "pipe"] }),
    configAndroid.blockedPermissions,
  );
  const configEmbutida = JSON.parse(executar("unzip", ["-p", apkGerado, "assets/app.config"], { stdio: ["ignore", "pipe", "pipe"] }));
  if (configEmbutida.extra?.ambiente !== servidor.ambiente || configEmbutida.extra?.apiUrl !== servidor.apiUrl || configEmbutida.android?.versionCode !== versao) throw new Error("Ambiente, endpoint ou versão embutidos no APK divergem do build.");
  const entradas = executar("unzip", ["-Z1", apkGerado], { stdio: ["ignore", "pipe", "pipe"] }).split("\n");
  // O Android pode renomear recursos. Confere conteúdo por SHA256; modelos
  // de código de barras trazidos pela câmera não contam como facial.
  const modelosEmpacotados = new Map(entradas.filter(e => e.endsWith(".tflite")).map(entrada => [
    createHash("sha256").update(executar("unzip", ["-p", apkGerado, entrada], { encoding: null, stdio: ["ignore", "pipe", "pipe"] })).digest("hex"), entrada,
  ]));
  const modelos = ["face_detection_front.tflite", "facenet_512.tflite"].map(arquivo => {
    const sha256 = createHash("sha256").update(readFileSync(path.join(APP, "assets/modelos", arquivo))).digest("hex");
    const recurso = modelosEmpacotados.get(sha256);
    if (!recurso) throw new Error(`Modelo ${arquivo} ausente ou diferente no APK.`);
    return { arquivo, recurso, sha256 };
  });
  if (entradas.some(e => /\.(jks|keystore|p12)$/i.test(e))) throw new Error("Arquivo privado de assinatura encontrado no APK.");
  const anterior = arg("anterior");
  if (anterior) {
    const n = JSON.parse(readFileSync(anterior, "utf8"));
    if (n.package !== identidade[1] || n.certificadoSha256 !== certificadoSha256 || n.versionCode >= versao) throw new Error("Atualização incompatível: pacote/chave precisam ser os mesmos e versionCode maior.");
  }
  mkdirSync(saida, { recursive: true });
  const nome = `ponto-obra-homologacao-${versao}.apk`;
  const apk = path.join(saida, nome);
  copyFileSync(apkGerado, apk);
  const sha256 = createHash("sha256").update(readFileSync(apk)).digest("hex");
  const evidencias = {
    arquivo: nome, sha256, bytes: statSync(apk).size, package: identidade[1], versionCode: versao, versionName: identidade[3],
    ambiente: servidor.ambiente, apiUrl: servidor.apiUrl, varianteHomologacao: varianteHomologacao || null, backendConfirmadoEm: inicioConsulta,
    certificadoSha256, commit, fonteComAlteracoesLocais: sujo, fonteSha256: env.PONTO_SOURCE_FINGERPRINT,
    compiladoEm: new Date().toISOString(), arquiteturas: arquiteturas.split(","),
    custoNuvem: 0, compilador: "Gradle local 9.3.1", buildTools: "36.0.0", ndk: "27.1.12297006",
    modelos, permissoes, verificacoes: { assinatura: true, pacoteHomologacao: true, endpointEmbutido: true, backendIsolado: true, permissoesFinais: true, atualizacaoCompativel: !!anterior, testeFisico: false },
  };
  writeFileSync(path.join(saida, `ponto-obra-homologacao-${versao}.json`), JSON.stringify(evidencias, null, 2) + "\n");
  writeFileSync(path.join(saida, `${nome}.sha256`), `${sha256}  ${nome}\n`);
  process.stdout.write(`APK conferido: ${apk}\nSHA256: ${sha256}\nTeste físico de câmera, reinício, offline e atualização continua obrigatório antes do uso em obra.\n`);
} finally {
  writeFileSync(path.join(APP, "package.json"), pacoteAntes);
}
