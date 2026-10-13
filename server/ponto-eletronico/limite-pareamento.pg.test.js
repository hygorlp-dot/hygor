// @vitest-environment node
//
// RESISTÊNCIA do limitador do ponto (limite-pareamento.js) contra as RPCs
// REAIS auth_rate_limit_* (migrations 20260726/20260727) em Postgres de
// verdade, com várias conexões simultâneas - prova que a contagem ANTES de
// olhar o código/PIN segura rajadas paralelas (o banco falso e o PGlite têm
// uma conexão só).
//
// Roda na CI (job rep-p-arp-postgres). Local: PONTO_PG_URL=postgres://... de
// um banco descartável. PONTO_LIMITE_PGLITE=1 roda a mesma lógica no PGlite
// (sem concorrência real - só confere as regras).
//
// Onde o mecanismo FALHA ABERTO (deixa passar) e FECHADO (bloqueia):
// - RPC com erro ou conexão caída: ABERTO (applyPersistentAuthRateLimit
//   devolve null; o pareamento ainda exige o código de uso único de 8 dígitos
//   e o cadastro facial ainda exige o PIN certo). Mesma política do login.
// - Origem/teto/PIN no limite: FECHADO até a janela passar, inclusive para o
//   código/PIN certos.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authRateLimitSubject } from "../app-auth-security.js";
import { PAPEIS_SUPABASE } from "./banco-pglite.test-helper.js";
import { LIMITE_PAREAMENTO, LIMITE_PIN_RESPONSAVEL, criarLimitePareamento, criarLimitePinResponsavel, sujeitoDoPin } from "./limite-pareamento.js";

const URL_PG = process.env.PONTO_PG_URL;
const MODO = URL_PG ? "postgres" : process.env.PONTO_LIMITE_PGLITE ? "pglite" : null;
const MIGRATIONS = ["20260726_auth_rate_limit.sql", "20260727_auth_rate_limit_success.sql"]
  .map(f => readFileSync(path.resolve(import.meta.dirname, "../../migrations", f), "utf8"));

let consultar, executar, encerrar;
// Adaptador mínimo do supabase-js: só db.rpc, com argumentos nomeados.
const banco = () => ({
  async rpc(nome, params) {
    if (!/^auth_rate_limit_(status|failure|success)$/.test(nome)) throw new Error(`rpc inesperada: ${nome}`);
    const chaves = Object.keys(params);
    try {
      const linhas = await consultar(`select * from public.${nome}(${chaves.map((k, i) => `${k} => $${i + 1}`).join(", ")})`, chaves.map(k => params[k]));
      return { data: linhas, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  },
});
const de = ip => ({ "x-forwarded-for": `${ip}, 10.0.0.1` });
const novaEmpresa = () => `limite-${randomUUID()}`;
const linhaDe = async (company, sujeito) => (await consultar(
  "select attempts, blocked_until from public.auth_rate_limits where company_id = $1 and subject_hash = $2", [company, authRateLimitSubject(company, sujeito)]))[0];
const esperar = ms => new Promise(r => setTimeout(r, ms));

describe.skipIf(!MODO)(`limitador do ponto contra as RPCs reais (${MODO || "pulado"})`, () => {
  beforeAll(async () => {
    if (MODO === "postgres") {
      const { default: postgres } = await import("postgres");
      const sql = postgres(URL_PG, { max: 20, onnotice: () => {} });
      consultar = (texto, valores) => sql.unsafe(texto, valores);
      executar = texto => sql.unsafe(texto);
      encerrar = () => sql.end({ timeout: 5 });
    } else {
      const { PGlite } = await import("@electric-sql/pglite");
      const pg = new PGlite();
      consultar = async (texto, valores) => (await pg.query(texto, valores)).rows;
      executar = texto => pg.exec(texto);
      encerrar = () => pg.close();
    }
    await executar(PAPEIS_SUPABASE);
    for (const m of MIGRATIONS) await executar(m);
  }, 60000);
  afterAll(async () => { await encerrar?.(); });

  it("1. tentativas simultâneas da mesma origem: só N olham o código", async () => {
    const company = novaEmpresa(), limite = criarLimitePareamento({ db: banco(), company });
    const rs = await Promise.all(Array.from({ length: 60 }, () => limite.tentar(de("203.0.113.7"))));
    expect(rs.filter(r => !r.bloqueado)).toHaveLength(LIMITE_PAREAMENTO.porOrigem.falhas);
    expect(rs.filter(r => r.bloqueado).every(r => r.tentarDeNovoEmSegundos > 0)).toBe(true);
  });

  it("2/3/4. origem trocada a cada tentativa (muitos IPs ou x-forwarded-for forjado): o teto global segura", async () => {
    const company = novaEmpresa(), limite = criarLimitePareamento({ db: banco(), company });
    // Cada tentativa com um "IP" diferente - escapa do limite por origem, não do global.
    const rs = await Promise.all(Array.from({ length: 80 }, (_, i) => limite.tentar(de(`198.51.${i >> 8}.${i & 255}`))));
    expect(rs.filter(r => !r.bloqueado)).toHaveLength(LIMITE_PAREAMENTO.global.falhas);
    // Sequencial, alternando origens: o mesmo teto (o contador é do banco, não da instância).
    const company2 = novaEmpresa(), limite2 = criarLimitePareamento({ db: banco(), company: company2 });
    let liberadas = 0;
    for (let i = 0; i < 40; i++) if (!(await limite2.tentar(de(i % 2 ? "203.0.113.1" : `192.0.2.${i}`))).bloqueado) liberadas++;
    expect(liberadas).toBeLessThanOrEqual(LIMITE_PAREAMENTO.global.falhas);
  });

  it("5/7. bloqueado = recusa sem contar de novo (código certo também espera; o bloqueio não é estendido)", async () => {
    const company = novaEmpresa(), limite = criarLimitePareamento({ db: banco(), company });
    for (let i = 0; i <= LIMITE_PAREAMENTO.porOrigem.falhas; i++) await limite.tentar(de("203.0.113.9"));
    const antes = await linhaDe(company, "ponto-parear|origem:203.0.113.9");
    for (let i = 0; i < 10; i++) expect((await limite.tentar(de("203.0.113.9"))).bloqueado).toBe(true);
    const depois = await linhaDe(company, "ponto-parear|origem:203.0.113.9");
    expect(Number(depois.attempts)).toBe(Number(antes.attempts));
    expect(new Date(depois.blocked_until).getTime()).toBe(new Date(antes.blocked_until).getTime());
  });

  it("6. a janela esgota e libera (bloqueio sempre temporário)", async () => {
    const company = novaEmpresa();
    const curto = { porOrigem: { falhas: 2, janelaSegundos: 1 }, global: { falhas: 100, janelaSegundos: 1 } };
    const limite = criarLimitePareamento({ db: banco(), company, limites: curto });
    await limite.tentar(de("203.0.113.5")); await limite.tentar(de("203.0.113.5"));
    expect((await limite.tentar(de("203.0.113.5"))).bloqueado).toBe(true);
    await esperar(2100);
    expect((await limite.tentar(de("203.0.113.5"))).bloqueado).toBe(false);
  }, 15000);

  it("acerto zera só a origem; o global não", async () => {
    const company = novaEmpresa(), limite = criarLimitePareamento({ db: banco(), company });
    await limite.tentar(de("203.0.113.3"));
    await limite.acertou(de("203.0.113.3"));
    expect(await linhaDe(company, "ponto-parear|origem:203.0.113.3")).toBeUndefined();
    expect(Number((await linhaDe(company, "ponto-parear|global")).attempts)).toBe(1);
  });

  it("8/9. RPC com erro ou conexão caída: falha ABERTA (documentado) e sem exceção", async () => {
    const company = novaEmpresa();
    const comErro = { rpc: async () => ({ data: null, error: { message: "function does not exist" } }) };
    const semConexao = { rpc: async () => { throw new Error("ECONNREFUSED"); } };
    for (const db of [comErro, semConexao]) {
      expect(await criarLimitePareamento({ db, company }).tentar(de("203.0.113.4"))).toEqual({ bloqueado: false, tentarDeNovoEmSegundos: 0 });
      expect(await criarLimitePinResponsavel({ db, company }).tentar("disp-1")).toEqual({ bloqueado: false, tentarDeNovoEmSegundos: 0 });
    }
  });

  it("10. ataque automatizado ao PIN: rajada por aparelho passa só N; outro aparelho independe", async () => {
    const company = novaEmpresa(), limite = criarLimitePinResponsavel({ db: banco(), company });
    const rs = await Promise.all(Array.from({ length: 100 }, () => limite.tentar("aparelho-roubado")));
    expect(rs.filter(r => !r.bloqueado)).toHaveLength(LIMITE_PIN_RESPONSAVEL.falhas);
    expect((await limite.tentar("outro-aparelho")).bloqueado).toBe(false);
    // O sujeito vai como hash: o id do aparelho não aparece cru no banco.
    const linhas = await consultar("select subject_hash from public.auth_rate_limits where company_id = $1", [company]);
    expect(JSON.stringify(linhas)).not.toContain("aparelho-roubado");
    expect(linhas.map(l => l.subject_hash)).toContain(authRateLimitSubject(company, sujeitoDoPin("aparelho-roubado")));
  });

  it("teto global = negação de serviço do PAREAMENTO (não das batidas): 31 tentativas de qualquer um bloqueiam todos por 15 min", async () => {
    const company = novaEmpresa(), limite = criarLimitePareamento({ db: banco(), company });
    for (let i = 0; i < LIMITE_PAREAMENTO.global.falhas; i++) await limite.tentar(de(`192.0.2.${i}`));
    const legitimo = await limite.tentar(de("198.51.100.77"));
    expect(legitimo.bloqueado).toBe(true);
    expect(legitimo.tentarDeNovoEmSegundos).toBeLessThanOrEqual(LIMITE_PAREAMENTO.global.janelaSegundos);
  });
});
