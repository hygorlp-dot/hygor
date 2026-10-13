// @vitest-environment node
//
// CLI da HOMOLOGAÇÃO ISOLADA em Postgres REAL (job rep-p-arp-postgres), com
// bancos descartáveis criados e apagados pelo teste - nunca em produção:
// provisionar -> conferir -> código -> resetar -> provisionar de novo, e as
// recusas (banco sem marcador; mesma URL da "produção"; confirmação errada).
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { PAPEIS_SUPABASE } from "../../server/ponto-eletronico/banco-pglite.test-helper.js";
import { identidadeBanco } from "../migracoes-ponto/locais.mjs";
import { MARCADOR_BANCO } from "./homologacao.mjs";

const URL_PG = process.env.PONTO_PG_URL;
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let admin; const bancos = [];
const urlDe = nome => { const u = new URL(URL_PG); u.pathname = `/${nome}`; return u.toString(); };
async function banco({ marcar = true } = {}) {
  admin ??= postgres(URL_PG, { max: 1, onnotice: () => {} });
  const nome = `ponto_homolog_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await admin.unsafe(`create database ${nome}`);
  if (marcar) await admin.unsafe(`comment on database ${nome} is '${MARCADOR_BANCO}'`);
  bancos.push(nome);
  const sql = postgres(urlDe(nome), { max: 1, onnotice: () => {} });
  await sql.unsafe(PAPEIS_SUPABASE);
  await sql.end({ timeout: 5 });
  return nome;
}
afterAll(async () => {
  for (const b of bancos) await admin?.unsafe(`drop database if exists ${b} with (force)`).catch(() => admin?.unsafe(`drop database if exists ${b}`));
  await admin?.end({ timeout: 5 });
});
const cli = (args, env) => {
  try { return { codigo: 0, saida: execFileSync(process.execPath, [path.join(raiz, "scripts/homologacao/cli.mjs"), ...args], { cwd: raiz, env: { ...process.env, POSTGRES_URL_NON_POOLING: "", ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e) { return { codigo: e.status, saida: `${e.stdout || ""}${e.stderr || ""}` }; }
};

describe.skipIf(!URL_PG)("homologação isolada em Postgres real (linha de comando)", () => {
  it("provisionar, conferir, código, resetar e provisionar de novo; recusas de destino", async () => {
    const nome = await banco();
    const env = { PONTO_HOMOLOGACAO_DB_URL: urlDe(nome), PONTO_HOMOLOGACAO_PIN: "4821" };
    const ident = identidadeBanco(urlDe(nome));
    // Sem confirmação: recusa sem alterar nada.
    expect(cli(["provisionar"], env)).toMatchObject({ codigo: 1, saida: expect.stringMatching(/confirme o banco de homologação/) });
    const p = cli(["provisionar", `--confirmo-homologacao=${ident}`], env);
    expect(p).toMatchObject({ codigo: 0, saida: expect.stringMatching(/Homologação provisionada \(NÃO OFICIAL\): gate GO 019[\s\S]*6 trabalhadores sintéticos/) });
    expect(p.saida).not.toContain(urlDe(nome));
    expect(cli(["conferir"], env)).toMatchObject({ codigo: 0, saida: expect.stringMatching(/marcador homologacao, gate GO 019, dados sintéticos true/) });
    expect(cli(["codigo"], env)).toMatchObject({ codigo: 0, saida: expect.stringMatching(/Código de pareamento \(homologação, obra homolog-obra-1[^)]*\): \d{8}/) });
    expect(cli(["resetar", `--confirmo-homologacao=${ident}`], env)).toMatchObject({ codigo: 0, saida: expect.stringMatching(/apagado/) });
    expect(cli(["provisionar", `--confirmo-homologacao=${ident}`], env)).toMatchObject({ codigo: 0, saida: expect.stringMatching(/gate GO 019/) });
    // --api nunca aceita a produção.
    expect(cli(["conferir", "--api", "https://pontosarcd.vercel.app/api/data"], env)).toMatchObject({ codigo: 1, saida: expect.stringMatching(/NÃO pode ser a produção/) });

    // Banco sem o marcador (pode ser a produção): recusado.
    const semMarca = await banco({ marcar: false });
    const e2 = { PONTO_HOMOLOGACAO_DB_URL: urlDe(semMarca), PONTO_HOMOLOGACAO_PIN: "4821" };
    expect(cli(["provisionar", `--confirmo-homologacao=${identidadeBanco(urlDe(semMarca))}`], e2)).toMatchObject({ codigo: 1, saida: expect.stringMatching(/não está marcado como homologação/) });
    expect(cli(["resetar", `--confirmo-homologacao=${identidadeBanco(urlDe(semMarca))}`], e2)).toMatchObject({ codigo: 1 });
    // A mesma URL da produção do operador: recusada antes de conectar.
    expect(cli(["conferir"], { ...env, POSTGRES_URL_NON_POOLING: urlDe(nome) })).toMatchObject({ codigo: 1, saida: expect.stringMatching(/mesma URL de POSTGRES_URL_NON_POOLING/) });
  }, 300000);
});
