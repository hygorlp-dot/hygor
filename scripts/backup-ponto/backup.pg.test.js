// @vitest-environment node
//
// ENSAIO DE RECUPERAÇÃO de ponta a ponta em Postgres REAL (job
// rep-p-arp-postgres), com as LINHAS DE COMANDO de verdade: banco de origem
// descartável com dados sintéticos -> scripts/backup-ponto.mjs (somente
// leitura, pacote cifrado fora do repositório) -> scripts/restaurar-backup-ponto.mjs
// num segundo banco descartável -> conferência. E as recusas do restaurador.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { PAPEIS_SUPABASE, lerMigration } from "../../server/ponto-eletronico/banco-pglite.test-helper.js";

const URL_PG = process.env.PONTO_PG_URL;
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sha256 = v => createHash("sha256").update(v).digest("hex");
const C = "arcd", ZERO = "0".repeat(64);
let admin; const bancos = [];
const urlDe = nome => { const u = new URL(URL_PG); u.pathname = `/${nome}`; return u.toString(); };
const identidade = nome => { const u = new URL(URL_PG); return `${u.hostname}/${nome}`; };
async function banco() {
  admin ??= postgres(URL_PG, { max: 1, onnotice: () => {} });
  const nome = `ponto_bkp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await admin.unsafe(`create database ${nome}`);
  bancos.push(nome);
  return nome;
}
afterAll(async () => { for (const b of bancos) await admin?.unsafe(`drop database if exists ${b}`); await admin?.end({ timeout: 5 }); });
const rodar = (script, args, env) => {
  try { return { ok: true, saida: execFileSync(process.execPath, [path.join(raiz, "scripts", script), ...args], { cwd: raiz, env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e) { return { ok: false, saida: `${e.stdout || ""}${e.stderr || ""}` }; }
};

describe.skipIf(!URL_PG)("backup e restauração do ponto em Postgres real (linhas de comando)", () => {
  it("origem -> backup cifrado -> restauração em banco descartável -> conferência; recusas do restaurador", async () => {
    const origem = await banco(), destino = await banco();
    const sql = postgres(urlDe(origem), { max: 1, onnotice: () => {} });
    try {
      await sql.unsafe(PAPEIS_SUPABASE);
      for (const f of ["016_create_ponto_eletronico.up.sql", "017_ponto_arp_estabelecimento_nsr.up.sql", "018_ponto_apropriacoes.up.sql", "019_ponto_integridade_fiscal.up.sql"]) await sql.unsafe(lerMigration(f));
      const estab = randomUUID(), disp = randomUUID();
      await sql`insert into public.ponto_estabelecimentos(company_id,id,nome,criado_por) values (${C}, ${estab}, 'Matriz', 'admin')`;
      await sql`insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values (${C}, ${disp}, 'obra-1', 'A', ${sha256(disp)}, 'admin')`;
      await sql`insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values (${C}, 'obra-1', ${estab}, 'admin')`;
      let ant = ZERO;
      for (let s = 1; s <= 3; s++) {
        const h = sha256(`${disp}-${s}`);
        await sql`select * from public.ponto_arp_registrar(${C}, ${disp}::uuid, ${sql.json([{ formatVersion: 2, eventId: randomUUID(), deviceId: disp, localSequence: s, localPreviousHash: ant, localHash: h,
          tipoRegistro: "ponto", employeeId: "emp-1", cpf: "12345678909", marcadoEm: new Date().toISOString(), horaConfiavel: true, metodo: "facial" }])}, ${sql.json({ serverTime: new Date().toISOString(), source: "host", toleranciaMs: 30000 })})`;
        ant = h;
      }
    } finally { await sql.end({ timeout: 5 }); }

    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "ponto-bkp-"));
    const chave = randomBytes(32).toString("base64");
    const b = rodar("backup-ponto.mjs", ["--saida", pasta, "--autorizado-por", "ci"], { POSTGRES_URL_NON_POOLING: urlDe(origem), PONTO_BACKUP_KEY: chave });
    expect(b.saida).toMatch(/cadeias fiscais íntegras: true/);
    const pacote = path.join(pasta, fs.readdirSync(pasta).find(f => f.endsWith(".arcdponto")));
    const manifesto = JSON.parse(fs.readFileSync(`${pacote}.manifest.json`, "utf8"));
    expect(manifesto).toMatchObject({ origem: identidade(origem), autorizadoPor: "ci", fiscal: [expect.objectContaining({ ultimoNsr: 3, cadeiaIntegra: true })] });
    expect(fs.readFileSync(pacote).includes(Buffer.from("12345678909"))).toBe(false);

    const env = { PONTO_BACKUP_KEY: chave, POSTGRES_URL_NON_POOLING: "" };
    // Recusas: sem confirmação; destino = origem; chave errada.
    expect(rodar("restaurar-backup-ponto.mjs", ["--pacote", pacote], { ...env, PONTO_RESTAURAR_URL: urlDe(destino) })).toMatchObject({ ok: false, saida: expect.stringMatching(/confirme que o destino é descartável/) });
    expect(rodar("restaurar-backup-ponto.mjs", ["--pacote", pacote, `--confirmo-descartavel=${identidade(origem)}`], { ...env, PONTO_RESTAURAR_URL: urlDe(origem) })).toMatchObject({ ok: false, saida: expect.stringMatching(/destino é o banco de origem/) });
    expect(rodar("restaurar-backup-ponto.mjs", ["--pacote", pacote, `--confirmo-descartavel=${identidade(destino)}`], { ...env, PONTO_BACKUP_KEY: randomBytes(32).toString("base64"), PONTO_RESTAURAR_URL: urlDe(destino) }).ok).toBe(false);
    // Restauração de verdade.
    const r = rodar("restaurar-backup-ponto.mjs", ["--pacote", pacote, `--confirmo-descartavel=${identidade(destino)}`], { ...env, PONTO_RESTAURAR_URL: urlDe(destino) });
    expect(r).toMatchObject({ ok: true, saida: expect.stringMatching(/Restaurado e conferido: .*NSR 1\.\.3 íntegra/) });
    // Segunda vez: destino já tem dados -> recusa.
    expect(rodar("restaurar-backup-ponto.mjs", ["--pacote", pacote, `--confirmo-descartavel=${identidade(destino)}`], { ...env, PONTO_RESTAURAR_URL: urlDe(destino) })).toMatchObject({ ok: false, saida: expect.stringMatching(/só em banco vazio/) });
    fs.rmSync(pasta, { recursive: true, force: true });
  }, 180000);
});
