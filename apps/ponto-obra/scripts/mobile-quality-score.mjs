#!/usr/bin/env node
// Scorecard objetivo do Ponto de Obra.
//
//   node scripts/mobile-quality-score.mjs [--evidencias quality-out/evidencias.json]
//        [--vitest quality-out/vitest.json] [--raiz <app>] [--saida quality-out]
//        [--baseline quality/baseline.json] [--exigir-evidencias] [--salvar-baseline]
//
// Gera mobile-quality-report.json e .md. Sai com código 1 quando algo
// BLOQUEIA: gate marcado "bloqueia" falhando, ou regressão mensurável numa
// categoria crítica (gate que passava na baseline e agora falha). Estética
// subjetiva nunca bloqueia: só os gates objetivos. Ver docs/QUALITY-SCORECARD.md.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIAS, CATEGORIAS_CRITICAS } from "./qualidade/gates.mjs";

const arg = (nome, padrao = null) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const flag = nome => process.argv.includes(`--${nome}`);

const APP = path.resolve(arg("raiz", path.join(path.dirname(fileURLToPath(import.meta.url)), "..")));
const RAIZ_REPO = path.resolve(APP, "../..");
const SAIDA = path.resolve(APP, arg("saida", "quality-out"));
const lerJson = p => (p && existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);

export function montarContexto({ app = APP, evidencias = null, vitest = null } = {}) {
  const raiz = path.resolve(app, "../..");
  const testes = [];
  if (vitest) {
    for (const arquivo of vitest.testResults || []) {
      for (const t of arquivo.assertionResults || []) {
        // Título completo (describe › it): gates podem citar o bloco ou o caso.
        testes.push({ arquivo: path.relative(raiz, arquivo.name), titulo: [...(t.ancestorTitles || []), t.title].join(" › "), status: t.status });
      }
    }
  }
  const arquivosApp = () => {
    const lista = ["App.js"];
    const andar = dir => { for (const n of readdirSync(path.join(app, dir))) { const rel = path.join(dir, n); if (statSync(path.join(app, rel)).isDirectory()) andar(rel); else if (/\.js$/.test(n)) lista.push(rel); } };
    andar("src");
    return lista;
  };
  return {
    app, raiz, evidencias, testes,
    vitest: vitest ? { total: vitest.numTotalTests, aprovados: vitest.numPassedTests, falhas: vitest.numFailedTests } : null,
    ler: rel => readFileSync(path.join(app, rel), "utf8"),
    lerRaiz: rel => readFileSync(path.join(raiz, rel), "utf8"),
    existe: rel => existsSync(path.join(app, rel)),
    arquivosApp,
  };
}

export function pontuar(ctx, { exigirEvidencias = false } = {}) {
  const categorias = CATEGORIAS.map(cat => {
    const gates = cat.gates.map(g => {
      let r = g.verificar(ctx);
      if (exigirEvidencias && r.status === "nao_verificado") r = { status: "fail", detalhe: `${r.detalhe} (evidência exigida)` };
      return { id: g.id, descricao: g.descricao, peso: g.peso, bloqueia: !!g.bloqueia, ...r };
    });
    const total = gates.reduce((s, g) => s + g.peso, 0);
    const aprovado = gates.filter(g => g.status === "pass").reduce((s, g) => s + g.peso, 0);
    const bruta = Math.round((10 * aprovado / total) * 10) / 10;
    const motivoTeto = cat.teto?.enquanto(ctx) || null;
    const nota = motivoTeto ? Math.min(bruta, cat.teto.valor) : bruta;
    return { id: cat.id, nome: cat.nome, critica: !!cat.critica, nota, notaSemTeto: bruta, teto: motivoTeto ? { valor: cat.teto.valor, motivo: motivoTeto } : null, gates };
  });
  const geral = Math.round((categorias.reduce((s, c) => s + c.nota, 0) / categorias.length) * 10) / 10;
  const bloqueios = categorias.flatMap(c => c.gates.filter(g => g.bloqueia && g.status === "fail").map(g => `${c.id}/${g.id}: ${g.detalhe}`));
  return { categorias, geral, bloqueios };
}

// Regressão mensurável: gate de categoria CRÍTICA que passava na baseline e
// agora não passa. Gate novo (não existia na baseline) não conta.
export function regressoes(atual, baseline) {
  if (!baseline) return [];
  const antes = new Map(baseline.categorias.flatMap(c => c.gates.map(g => [`${c.id}/${g.id}`, g.status])));
  return atual.categorias.filter(c => CATEGORIAS_CRITICAS.includes(c.id))
    .flatMap(c => c.gates.filter(g => antes.get(`${c.id}/${g.id}`) === "pass" && g.status !== "pass").map(g => `${c.id}/${g.id} passava na baseline e agora: ${g.status} (${g.detalhe})`));
}

function markdown(rel) {
  const linhas = [
    "# Scorecard do Ponto de Obra", "",
    `- Gerado em: ${rel.geradoEm}`, `- Commit: \`${rel.sha || "?"}\``, `- Nota geral: **${rel.geral}**${rel.baseline ? ` (baseline ${rel.baseline.geral})` : ""}`,
    `- Bloqueios: ${rel.bloqueios.length ? rel.bloqueios.length : "nenhum"}`, `- Regressões em categorias críticas: ${rel.regressoes.length || "nenhuma"}`, "",
    "| Categoria | Nota | Sem teto | Baseline | Gates | Teto |", "| --- | ---: | ---: | ---: | ---: | --- |",
  ];
  const base = new Map((rel.baseline?.categorias || []).map(c => [c.id, c.nota]));
  for (const c of rel.categorias) {
    const passados = c.gates.filter(g => g.status === "pass").length;
    linhas.push(`| ${c.nome}${c.critica ? " *" : ""} | ${c.nota.toFixed(1)} | ${c.notaSemTeto.toFixed(1)} | ${base.has(c.id) ? base.get(c.id).toFixed(1) : "-"} | ${passados}/${c.gates.length} | ${c.teto ? `${c.teto.valor} (${c.teto.motivo})` : "-"} |`);
  }
  linhas.push("", "\\* categoria crítica: regressão bloqueia a CI.", "");
  for (const c of rel.categorias) {
    const pendentes = c.gates.filter(g => g.status !== "pass");
    if (!pendentes.length) continue;
    linhas.push(`## ${c.nome}`, "");
    for (const g of pendentes) linhas.push(`- ${g.status === "fail" ? "FALHA" : "NÃO VERIFICADO"}${g.bloqueia ? " (bloqueia)" : ""}: ${g.descricao} — ${g.detalhe}`);
    linhas.push("");
  }
  if (rel.bloqueios.length) linhas.push("## Bloqueios", "", ...rel.bloqueios.map(b => `- ${b}`), "");
  if (rel.regressoes.length) linhas.push("## Regressões", "", ...rel.regressoes.map(b => `- ${b}`), "");
  return linhas.join("\n");
}

const executadoDireto = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const evidencias = lerJson(path.resolve(APP, arg("evidencias", "quality-out/evidencias.json")));
  const vitest = lerJson(path.resolve(APP, arg("vitest", "quality-out/vitest.json")));
  const baselineArq = path.resolve(APP, arg("baseline", "quality/baseline.json"));
  const baseline = lerJson(baselineArq);
  const ctx = montarContexto({ evidencias, vitest });
  const r = pontuar(ctx, { exigirEvidencias: flag("exigir-evidencias") });
  const rel = {
    geradoEm: new Date().toISOString(), sha: evidencias?.sha || null, ...r,
    regressoes: regressoes(r, baseline),
    baseline: baseline ? { geral: baseline.geral, sha: baseline.sha, categorias: baseline.categorias.map(c => ({ id: c.id, nota: c.nota })) } : null,
    evidencias: evidencias ? { passos: Object.fromEntries(Object.entries(evidencias.passos || {}).map(([k, v]) => [k, { ok: v.ok, ms: v.ms, detalhe: v.detalhe }])), metricas: evidencias.metricas || null } : null,
  };
  mkdirSync(SAIDA, { recursive: true });
  writeFileSync(path.join(SAIDA, "mobile-quality-report.json"), `${JSON.stringify(rel, null, 2)}\n`);
  writeFileSync(path.join(SAIDA, "mobile-quality-report.md"), `${markdown(rel)}\n`);
  if (flag("salvar-baseline")) {
    mkdirSync(path.dirname(baselineArq), { recursive: true });
    writeFileSync(baselineArq, `${JSON.stringify({ geradoEm: rel.geradoEm, sha: rel.sha, geral: rel.geral, categorias: rel.categorias.map(c => ({ id: c.id, nota: c.nota, gates: c.gates.map(g => ({ id: g.id, status: g.status })) })) }, null, 2)}\n`);
  }
  process.stdout.write(`${markdown(rel)}\n`);
  const bloqueia = rel.bloqueios.length + rel.regressoes.length;
  if (bloqueia) { process.stderr.write(`\n${bloqueia} bloqueio(s)/regressão(ões).\n`); process.exitCode = 1; }
}
