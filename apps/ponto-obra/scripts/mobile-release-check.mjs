#!/usr/bin/env node
// Release check do Ponto de Obra: tem que passar antes de qualquer build
// piloto (npm run mobile:release-check, na raiz do repositório).
//
// Roda, gravando evidência de cada passo em quality-out/evidencias.json:
//   árvore limpa → testes (Vitest JSON) → expo-doctor → bundle Android
//   (com os 2 .tflite) → prebuild + verificar-prebuild → versões → scorecard.
//
// O prebuild é descartável: android/ é apagado e os scripts que o prebuild
// troca no package.json voltam ao que estavam (sem `git checkout`, que
// desfaria mudanças ainda não commitadas).
//
// Opções:
//   --ci          exige toda evidência (nada "não verificado") e árvore limpa
//   --rapido      pula expo-doctor, bundle e prebuild (só testes + scorecard)
//   --offline     expo-doctor sem rede: checks que dependem de rede ficam
//                 "não verificado", não aprovados
//   --passada N   número da passada da rodada (1 a 3) - ver docs/QUALITY-SCORECARD.md
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ = path.resolve(APP, "../..");
const SAIDA = path.join(APP, "quality-out");
const flag = n => process.argv.includes(`--${n}`);
const arg = (n, p = null) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p; };
const CI = flag("ci"), RAPIDO = flag("rapido"), OFFLINE = flag("offline");
const PASSADA = Number(arg("passada", 0));
const MAX_PASSADAS = 3;

mkdirSync(SAIDA, { recursive: true });
const ev = { geradoEm: new Date().toISOString(), sha: "", modo: { ci: CI, rapido: RAPIDO, offline: OFFLINE }, passos: {}, metricas: {} };
const git = cmd => execSync(`git ${cmd}`, { cwd: RAIZ, encoding: "utf8" }).trim();
ev.sha = git("rev-parse HEAD");

const rodar = (nome, titulo, fn) => {
  process.stdout.write(`\n▶ ${titulo}\n`);
  const t0 = Date.now();
  let r;
  try { r = fn(); } catch (e) { r = { ok: false, detalhe: String(e.message || e).slice(0, 300) }; }
  ev.passos[nome] = { ...r, ms: Date.now() - t0 };
  process.stdout.write(`${r.ok ? "  ✓" : "  ✗"} ${titulo}${r.detalhe ? ` — ${r.detalhe}` : ""}\n`);
  return r;
};
// EXPO_OFFLINE só existe quando é offline: a CLI do Expo recusa valor vazio
// (GetEnv.NoBoolean) e quebrava o bundle e o prebuild na CI.
const ambienteExpo = OFFLINE ? { ...process.env, EXPO_OFFLINE: "1" } : process.env;
// Primeira linha de erro da ferramenta (não o fim do stack trace).
const primeiroErro = texto => {
  const linhas = `${texto}`.split("\n").map(l => l.trim()).filter(Boolean);
  return (linhas.find(l => /error|erro|falha/i.test(l) && !/^at\s/.test(l)) || linhas.filter(l => !/^at\s/.test(l)).slice(-2).join(" ")).slice(0, 300);
};
const exec = (cmd, args, opcoes = {}) => spawnSync(cmd, args, { cwd: APP, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, ...opcoes });

// Passadas da rodada: no máximo 3 (AUDIT→TEST→SCORE, POLISH→TEST→SCORE, final).
if (PASSADA) {
  if (PASSADA < 1 || PASSADA > MAX_PASSADAS) { process.stderr.write(`passada ${PASSADA} fora de 1..${MAX_PASSADAS}: documente o que ficou abaixo da meta em vez de insistir.\n`); process.exit(2); }
  ev.passada = PASSADA;
}

rodar("gitLimpo", "Árvore de trabalho limpa", () => {
  const sujos = git("status --porcelain").split("\n").filter(Boolean).filter(l => !/quality-out\//.test(l));
  return sujos.length ? { ok: false, detalhe: `${sujos.length} arquivo(s) não commitado(s)` } : { ok: true, detalhe: ev.sha.slice(0, 7) };
});

rodar("testes", "Testes do Ponto de Obra (app, domínio compartilhado e servidor)", () => {
  const r = exec("npx", ["vitest", "run", "apps/ponto-obra", "src/domains/ponto-eletronico", "server/ponto-eletronico", "server/ponto-eletronico-migration.pglite.test.js",
    "--reporter=default", "--reporter=json", `--outputFile.json=${path.join(SAIDA, "vitest.json")}`], { cwd: RAIZ, stdio: ["ignore", "inherit", "inherit"] });
  const j = JSON.parse(readFileSync(path.join(SAIDA, "vitest.json"), "utf8"));
  return { ok: r.status === 0 && j.numFailedTests === 0, detalhe: `${j.numPassedTests}/${j.numTotalTests} passando`, total: j.numTotalTests, falhas: j.numFailedTests };
});

if (!RAPIDO) {
  rodar("expoDoctor", "expo-doctor", () => {
    const r = exec("npx", ["expo-doctor"]);
    const saida = `${r.stdout}${r.stderr}`;
    const falhas = [...saida.matchAll(/^✖ (.+)$/gm)].map(m => m[1].trim());
    // Sem rede, estes dois checks consultam serviços externos e não dizem nada sobre o app.
    const DE_REDE = [/Expo config .*schema/i, /React Native Directory/i];
    const reais = OFFLINE ? falhas.filter(f => !DE_REDE.some(p => p.test(f))) : falhas;
    if (r.status === 0) return { ok: true, detalhe: (saida.match(/\d+\/\d+ checks passed/) || ["ok"])[0] };
    if (!reais.length) return { ok: !CI, detalhe: `só checks de rede falharam offline (${falhas.length}) - não verificados`, naoVerificado: falhas };
    return { ok: false, detalhe: reais.join("; ") };
  });

  rodar("bundle", "Bundle Android (Metro + modelos .tflite)", () => {
    rmSync(path.join(APP, "dist-ci"), { recursive: true, force: true });
    const r = exec("npx", ["expo", "export", "--platform", "android", "--output-dir", "dist-ci"], { env: ambienteExpo });
    if (r.status !== 0) return { ok: false, detalhe: primeiroErro(`${r.stderr}${r.stdout}`) };
    const meta = readFileSync(path.join(APP, "dist-ci/metadata.json"), "utf8");
    const tflite = (meta.match(/"ext":"tflite"/g) || []).length;
    const tamanho = Number(execSync(`du -sk dist-ci`, { cwd: APP, encoding: "utf8" }).split("\t")[0]);
    ev.metricas.bundleKb = tamanho;
    rmSync(path.join(APP, "dist-ci"), { recursive: true, force: true });
    return { ok: tflite >= 2, tflite, detalhe: `${tflite} .tflite, ${Math.round(tamanho / 1024 * 10) / 10} MB` };
  });

  rodar("prebuild", "Prebuild Android descartável + verificar-prebuild", () => {
    const pacoteAntes = readFileSync(path.join(APP, "package.json"), "utf8");
    try {
      const r = exec("npx", ["expo", "prebuild", "--platform", "android", "--no-install", "--clean"], { env: ambienteExpo });
      if (r.status !== 0) return { ok: false, detalhe: primeiroErro(`${r.stderr}${r.stdout}`) };
      const v = exec("node", ["scripts/verificar-prebuild.mjs"]);
      const manifesto = readFileSync(path.join(APP, "android/app/src/main/AndroidManifest.xml"), "utf8");
      const atividadesExportadas = [...manifesto.matchAll(/<activity[^>]*android:exported="true"/g)].length;
      const falhas = `${v.stdout}`.split("\n").filter(l => l.startsWith("FALHA"));
      return { ok: v.status === 0, atividadesExportadas, detalhe: v.status === 0 ? `prebuild conferido, ${atividadesExportadas} atividade(s) exportada(s)` : falhas.join("; ") };
    } finally {
      rmSync(path.join(APP, "android"), { recursive: true, force: true });
      writeFileSync(path.join(APP, "package.json"), pacoteAntes);
    }
  });
}

rodar("versoes", "Versões de release", () => {
  const app = JSON.parse(readFileSync(path.join(APP, "app.json"), "utf8")).expo;
  const rep = readFileSync(path.join(RAIZ, "src/domains/ponto-eletronico/rep-p.js"), "utf8").match(/versao:\s*"([^"]+)"/)?.[1];
  const expo = JSON.parse(readFileSync(path.join(APP, "node_modules/expo/package.json"), "utf8")).version;
  const rn = JSON.parse(readFileSync(path.join(APP, "node_modules/react-native/package.json"), "utf8")).version;
  ev.metricas.versoes = { appVersion: app.version, repSoftwareVersion: rep, expo, reactNative: rn, commit: ev.sha.slice(0, 7) };
  return { ok: /^\d+\.\d+\.\d+$/.test(app.version) && !!rep, detalhe: `app ${app.version} · REP ${rep} · Expo ${expo} · RN ${rn}` };
});

writeFileSync(path.join(SAIDA, "evidencias.json"), `${JSON.stringify(ev, null, 2)}\n`);
const score = spawnSync("node", ["scripts/mobile-quality-score.mjs", ...(CI ? ["--exigir-evidencias"] : [])], { cwd: APP, stdio: "inherit" });

// Histórico das passadas da rodada (sem dado pessoal; só notas e gates).
if (PASSADA) {
  const rel = JSON.parse(readFileSync(path.join(SAIDA, "mobile-quality-report.json"), "utf8"));
  const arq = path.join(APP, "quality/passadas.json");
  const hist = existsSync(arq) ? JSON.parse(readFileSync(arq, "utf8")) : { passadas: [] };
  hist.passadas = hist.passadas.filter(p => p.passada !== PASSADA);
  hist.passadas.push({ passada: PASSADA, sha: ev.sha.slice(0, 7), em: ev.geradoEm, geral: rel.geral, notas: Object.fromEntries(rel.categorias.map(c => [c.id, c.nota])), bloqueios: rel.bloqueios.length });
  hist.passadas.sort((a, b) => a.passada - b.passada);
  mkdirSync(path.dirname(arq), { recursive: true });
  writeFileSync(arq, `${JSON.stringify(hist, null, 2)}\n`);
}

const falhouObrigatorio = ["testes", ...(RAPIDO ? [] : ["expoDoctor", "bundle", "prebuild"]), "versoes", ...(CI ? ["gitLimpo"] : [])].filter(p => ev.passos[p] && !ev.passos[p].ok);
if (falhouObrigatorio.length || score.status !== 0) {
  process.stderr.write(`\nrelease-check REPROVADO${falhouObrigatorio.length ? `: ${falhouObrigatorio.join(", ")}` : ""}${score.status !== 0 ? " (scorecard bloqueou)" : ""}\n`);
  process.exit(1);
}
process.stdout.write("\nrelease-check APROVADO\n");
