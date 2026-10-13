// @vitest-environment node
//
// Livro de migrations num Postgres REAL (job rep-p-arp-postgres): cada teste
// cria um banco novo e descartável (CREATE DATABASE) e o apaga no fim.
//   - cenário de produção completo com conexões reais (postgres.js);
//   - dois "deploys" simultâneos: a trava de sessão (pg_advisory_lock)
//     serializa - um aplica/registra, o outro encontra tudo feito.
// Local: PONTO_PG_URL=postgres://usuario:senha@localhost:5432/banco (usuário
// com CREATEDB).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { PAPEIS_SUPABASE, lerMigration } from "../../server/ponto-eletronico/banco-pglite.test-helper.js";
import { adaptadorPostgres } from "./adaptadores.mjs";
import { CHAVE_TRAVA, aplicar, guardaScriptAntigo, verificarGate } from "./livro.mjs";
import { validarMigracao } from "./validacao.mjs";

const URL_PG = process.env.PONTO_PG_URL;
const manifesto = nome => JSON.parse(readFileSync(new URL(`./${nome}`, import.meta.url), "utf8")).migracoes;
const lerArquivo = async a => lerMigration(a);
const ANTIGAS = ["016_create_ponto_eletronico.up.sql", "017_ponto_arp_estabelecimento_nsr.up.sql", "018_ponto_apropriacoes.up.sql"];

let admin, bancos = [], conexoes = [];
async function bancoNovo() {
  admin ??= postgres(URL_PG, { max: 2, onnotice: () => {} });
  const nome = `ponto_livro_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await admin.unsafe(`create database ${nome}`);
  bancos.push(nome);
  const u = new URL(URL_PG); u.pathname = `/${nome}`;
  const sql = postgres(u.toString(), { max: 6, onnotice: () => {} });
  conexoes.push(sql);
  await sql.unsafe(PAPEIS_SUPABASE).catch(() => {});      // papéis são do cluster: podem já existir
  return sql;
}
afterAll(async () => { await admin?.end({ timeout: 5 }); });
afterEach(async () => {
  for (const c of conexoes.splice(0)) await c.end({ timeout: 5 });
  for (const b of bancos.splice(0)) await admin.unsafe(`drop database if exists ${b} with (force)`).catch(() => admin.unsafe(`drop database if exists ${b}`));
});

const funcoes = async sql => (await sql`select md5(string_agg(p.proname || pg_get_functiondef(p.oid), '|' order by p.proname)) h
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ponto%' and p.proname not like 'ponto_migracoes%'`)[0].h;

describe.skipIf(!URL_PG)("livro de migrations em Postgres real", () => {
  it("016 -> 017 -> 018 -> livro -> 019 -> novo deploy, com conexões reais: a 019 continua", async () => {
    const sql = await bancoNovo();
    for (let i = 0; i < 2; i++) for (const f of ANTIGAS) await sql.unsafe(lerMigration(f));     // deploys antigos
    const c = await sql.reserve();
    try {
      const db = adaptadorPostgres(c);
      expect(await guardaScriptAntigo(db, { lerArquivo })).toMatchObject({ acao: "seguir" });
      expect((await aplicar({ db, manifesto: manifesto("manifesto.json"), lerArquivo, origem: "ci" })).passos.map(p => p.acao))
        .toEqual(["registrar_existente", "registrar_existente", "registrar_existente"]);
      expect((await aplicar({ db, manifesto: manifesto("manifesto-com-019.json"), lerArquivo, origem: "ci" })).passos.map(p => p.acao))
        .toEqual(["ja_aplicada", "ja_aplicada", "ja_aplicada", "aplicar"]);
      const na019 = await funcoes(sql);
      expect(await guardaScriptAntigo(db, { lerArquivo })).toMatchObject({ acao: "pular" });
      expect((await aplicar({ db, manifesto: manifesto("manifesto-com-019.json"), lerArquivo, origem: "ci" })).passos.every(p => p.acao === "ja_aplicada")).toBe(true);
      expect(await funcoes(sql)).toBe(na019);
      expect((await validarMigracao(db, "019_ponto_integridade_fiscal.up.sql")).completa).toBe(true);
    } finally { c.release(); }
  }, 120000);

  it("dois deploys ao mesmo tempo: a trava de sessão serializa e o livro fica com uma linha por migration", async () => {
    const sql = await bancoNovo();
    const [c1, c2] = [await sql.reserve(), await sql.reserve()];
    try {
      const [r1, r2] = await Promise.all([c1, c2].map((c, i) => aplicar({ db: adaptadorPostgres(c), manifesto: manifesto("manifesto-com-019.json"), lerArquivo, origem: `ci:${i}` })));
      const acoes = [r1, r2].map(r => r.passos.map(p => p.acao).join(","));
      expect(acoes.sort()).toEqual(["aplicar,aplicar,aplicar,aplicar", "ja_aplicada,ja_aplicada,ja_aplicada,ja_aplicada"]);
      const linhas = await sql`select arquivo, modo from public.ponto_migracoes_aplicadas order by arquivo`;
      expect(linhas.map(l => l.modo)).toEqual(["aplicada", "aplicada", "aplicada", "aplicada"]);
      // postgres.js serializa parâmetro ::jsonb como JSON: o livro precisa gravar OBJETO, não string.
      expect((await sql`select distinct jsonb_typeof(validacao) t from public.ponto_migracoes_aplicadas`).map(l => l.t)).toEqual(["object"]);
    } finally { c1.release(); c2.release(); }
  }, 120000);

  it("trava com PRAZO: outra sessão segurando a trava -> erro explícito em ~1,5 s sem alterar nada; solta -> aplica", async () => {
    const sql = await bancoNovo();
    const [dono, c] = [await sql.reserve(), await sql.reserve()];
    try {
      await dono`select pg_advisory_lock(hashtextextended(${CHAVE_TRAVA}, 0))`;
      const inicio = Date.now();
      await expect(aplicar({ db: adaptadorPostgres(c), manifesto: manifesto("manifesto.json"), lerArquivo, origem: "ci", trava: { timeoutMs: 1500, intervaloMs: 100 } }))
        .rejects.toThrow(/trava do livro de migrations não obtida em 2 s.*Nada foi alterado/);
      const espera = Date.now() - inicio;
      expect(espera).toBeGreaterThanOrEqual(1400);
      expect(espera).toBeLessThan(10_000);                               // nunca espera indefinidamente
      expect((await sql`select to_regclass('public.ponto_migracoes_aplicadas') t`)[0].t).toBeNull();
      await dono`select pg_advisory_unlock(hashtextextended(${CHAVE_TRAVA}, 0))`;
      const r = await aplicar({ db: adaptadorPostgres(c), manifesto: manifesto("manifesto.json"), lerArquivo, origem: "ci", trava: { timeoutMs: 1500, intervaloMs: 100 } });
      expect(r.passos.map(p => p.acao)).toEqual(["aplicar", "aplicar", "aplicar"]);
      // A trava foi liberada no fim: outra sessão consegue de imediato.
      expect((await dono`select pg_try_advisory_lock(hashtextextended(${CHAVE_TRAVA}, 0)) ok`)[0].ok).toBe(true);
    } finally { dono.release(); c.release(); }
  }, 120000);

  it("conexão que segurava a trava cai: o Postgres solta e a próxima execução prossegue", async () => {
    const sql = await bancoNovo();
    const [dono, c] = [await sql.reserve(), await sql.reserve()];
    try {
      const [{ pid }] = await dono`select pg_backend_pid() pid, pg_advisory_lock(hashtextextended(${CHAVE_TRAVA}, 0))`;
      const execucao = aplicar({ db: adaptadorPostgres(c), manifesto: manifesto("manifesto.json"), lerArquivo, origem: "ci", trava: { timeoutMs: 15_000, intervaloMs: 100 } });
      await new Promise(r => setTimeout(r, 500));
      await sql`select pg_terminate_backend(${pid})`;                       // "deploy" anterior morreu
      expect((await execucao).passos.map(p => p.acao)).toEqual(["aplicar", "aplicar", "aplicar"]);
      expect(await verificarGate(adaptadorPostgres(c), { lerArquivo })).toMatchObject({ resultado: "GO", versaoFiscal: "018" });
    } finally { dono.release(); c.release(); }
  }, 120000);
});
