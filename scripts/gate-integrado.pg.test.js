// @vitest-environment node
//
// TESTE INTEGRADO DO GATE DE PRODUÇÃO em Postgres REAL (job
// rep-p-arp-postgres), com as LINHAS DE COMANDO de verdade e dados
// SINTÉTICOS - nunca em produção. Bancos e pastas descartáveis, criados e
// apagados pelo teste.
//   016/017/018 (deploys antigos) -> dados + NSR -> CLI do livro (implantar)
//   -> CLI do livro (019) -> CLI --verificar (GO) -> funções e registros
//   conferidos -> CLI de backup (com fotos) -> CLI de restauração noutro
//   banco + fotos -> RECUPERAÇÃO COMPLETA -> nova batida (NSR seguinte).
//   Negativos: restauração sem fotos (apenas banco), foto adulterada no
//   backup (inconsistente), gate NO-GO depois de 017 reaplicada por fora.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { PAPEIS_SUPABASE, lerMigration } from "../server/ponto-eletronico/banco-pglite.test-helper.js";
import { caminhoFotoCadastro, caminhoFotoMarcacao } from "../server/ponto-eletronico/fotos-caminho.js";
import { storagePasta } from "./backup-ponto/storages.mjs";
import { MARCADOR_DESCARTAVEL, identidadeBanco } from "./migracoes-ponto/locais.mjs";

const URL_PG = process.env.PONTO_PG_URL;
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = v => createHash("sha256").update(v).digest("hex");
const C = "arcd", ZERO = "0".repeat(64), CPF = "12345678909";
const jpeg = n => Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(`sintetica-${n}`)]);
let admin; const bancos = [], pastas = [];
const urlDe = nome => { const u = new URL(URL_PG); u.pathname = `/${nome}`; return u.toString(); };
const ident = nome => identidadeBanco(urlDe(nome));
async function banco() {
  admin ??= postgres(URL_PG, { max: 1, onnotice: () => {} });
  const nome = `ponto_gate_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await admin.unsafe(`create database ${nome}`);
  await admin.unsafe(`comment on database ${nome} is '${MARCADOR_DESCARTAVEL}'`);
  bancos.push(nome);
  return nome;
}
const pasta = () => { const p = fs.mkdtempSync(path.join(os.tmpdir(), "ponto-gate-")); pastas.push(p); return p; };
afterAll(async () => {
  for (const b of bancos) await admin?.unsafe(`drop database if exists ${b} with (force)`).catch(() => admin?.unsafe(`drop database if exists ${b}`));
  await admin?.end({ timeout: 5 });
  for (const p of pastas) fs.rmSync(p, { recursive: true, force: true });
});
const cli = (script, args, env) => {
  try { return { codigo: 0, saida: execFileSync(process.execPath, [path.join(raiz, "scripts", script), ...args], { cwd: raiz, env: { ...process.env, POSTGRES_URL_NON_POOLING: "", ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e) { return { codigo: e.status, saida: `${e.stdout || ""}${e.stderr || ""}` }; }
};

describe.skipIf(!URL_PG)("gate de produção integrado em Postgres real (linhas de comando)", () => {
  it("016 -> 017 -> 018 -> livro -> 019 -> deploy -> backup -> restauração completa -> nova batida", async () => {
    const origem = await banco(), destino = await banco();
    const fotosOrigem = pasta(), fotosDestino = pasta(), saida = pasta();
    const sql = postgres(urlDe(origem), { max: 1, onnotice: () => {} });
    let seq = 0, ultimo = ZERO;
    const estab = randomUUID(), disp = randomUUID();
    const bater = async (s, fotos) => {
      seq += 1;
      const h = sha256(`${disp}-${seq}`), foto = jpeg(`b${seq}`), marcadoEm = new Date().toISOString(), id = randomUUID();
      const [r] = await s`select * from public.ponto_arp_registrar(${C}, ${disp}::uuid, ${s.json([{ formatVersion: 2, eventId: id, deviceId: disp, localSequence: seq, localPreviousHash: ultimo,
        localHash: h, tipoRegistro: "ponto", employeeId: "emp-1", cpf: CPF, marcadoEm, horaConfiavel: true, metodo: "facial", fotoSha256: sha256(foto) }])},
        ${s.json({ serverTime: new Date().toISOString(), source: "host", status: "verificada", toleranciaMs: 30000 })})`;
      ultimo = h;
      await storagePasta(fotos).enviar(caminhoFotoMarcacao("obra-1", marcadoEm, id), foto);
      return r;
    };
    const fiscal = async s => (await s`select count(*)::int n, md5(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text)) h from public.ponto_arp_registros x`)[0];
    try {
      // 1-4: deploys antigos. 5-6: dados sintéticos e NSR.
      await sql.unsafe(PAPEIS_SUPABASE);
      for (let i = 0; i < 2; i++) for (const f of ["016_create_ponto_eletronico.up.sql", "017_ponto_arp_estabelecimento_nsr.up.sql", "018_ponto_apropriacoes.up.sql"]) await sql.unsafe(lerMigration(f));
      await sql`insert into public.ponto_estabelecimentos(company_id,id,nome,criado_por) values (${C}, ${estab}, 'Matriz', 'admin')`;
      await sql`insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values (${C}, ${disp}, 'obra-1', 'A', ${sha256(disp)}, 'admin')`;
      await sql`insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values (${C}, 'obra-1', ${estab}, 'admin')`;
      const bio = randomUUID(), fotoCad = jpeg("cad"), caminhoCad = caminhoFotoCadastro("emp-1", bio, 0);
      await storagePasta(fotosOrigem).enviar(caminhoCad, fotoCad);
      await sql`insert into public.ponto_biometrias(company_id,id,employee_id,modelo,vetor,fotos,consentimento,cadastrado_por) values (${C}, ${bio}, 'emp-1', 'm',
        ${sql.json(Array.from({ length: 64 }, (_, i) => i / 100))}, ${sql.json([{ caminho: caminhoCad, sha256: sha256(fotoCad) }])}, ${sql.json({ termoVersao: "2026-10", aceitoEm: "2026-10-01T10:00:00Z" })}, 'enc')`;
      for (let i = 0; i < 3; i++) await bater(sql, fotosOrigem);
      const antes = await fiscal(sql);
      const env = { POSTGRES_URL_NON_POOLING: urlDe(origem) };

      // 7: livro pela CLI (planeja, aplica). 8: 019 pela CLI. 9-10: gate GO.
      expect(cli("aplicar-migracoes-ponto.mjs", [], env).saida).toMatch(/registrar_existente[\s\S]*registrar_existente[\s\S]*registrar_existente[\s\S]*Nada foi alterado/);
      expect(cli("aplicar-migracoes-ponto.mjs", ["--aplicar"], env)).toMatchObject({ codigo: 1, saida: expect.stringMatching(/confirme o banco/) });
      expect(cli("aplicar-migracoes-ponto.mjs", ["--aplicar", `--confirmo-banco=${ident(origem)}`], env)).toMatchObject({ codigo: 0, saida: expect.stringMatching(/trava_obtida[\s\S]*Concluído/) });
      expect(cli("aplicar-migracoes-ponto.mjs", ["--manifesto", "scripts/migracoes-ponto/manifesto-com-019.json", "--aplicar", `--confirmo-banco=${ident(origem)}`], env))
        .toMatchObject({ codigo: 0, saida: expect.stringMatching(/019_ponto_integridade_fiscal\.up\.sql aplicar/) });
      expect(cli("aplicar-migracoes-ponto.mjs", ["--verificar"], env)).toMatchObject({ codigo: 0, saida: expect.stringMatching(/Gate: GO \(versão fiscal 019\)/) });
      expect((await sql`select prosrc from pg_proc where proname = 'ponto_arp_registrar'`)[0].prosrc).toContain("fonteGravacao");
      // 11: registros fiscais anteriores intactos.
      expect(await fiscal(sql)).toEqual(antes);

      // 12: backup pela CLI, com fotos (pasta = Storage do ensaio).
      const chave = randomBytes(32).toString("base64");
      const b = cli("backup-ponto.mjs", ["--saida", saida, "--autorizado-por", "ci", "--fotos-de-pasta", fotosOrigem], { ...env, PONTO_BACKUP_KEY: chave });
      expect(b).toMatchObject({ codigo: 0, saida: expect.stringMatching(/4 foto\(s\)[\s\S]*Consistência banco x Storage: consistente /) });
      const pacote = path.join(saida, fs.readdirSync(saida).find(f => f.endsWith(".arcdponto")));

      // 13-16: restauração noutro banco + fotos: COMPLETA, cadeia, NSR e contador.
      const restEnv = { PONTO_BACKUP_KEY: chave, PONTO_RESTAURAR_URL: urlDe(destino) };
      const r = cli("restaurar-backup-ponto.mjs", ["--pacote", pacote, `--confirmo-descartavel=${ident(destino)}`, "--fotos-em", fotosDestino], restEnv);
      expect(r).toMatchObject({ codigo: 0, saida: expect.stringMatching(/RECUPERAÇÃO COMPLETA: .*NSR 1\.\.3 íntegra; fotos: 4\/4 verificadas por SHA-256/) });
      for (const { caminho } of await storagePasta(fotosOrigem).listar()) {
        expect(sha256(await storagePasta(fotosDestino).baixar(caminho))).toBe(sha256(await storagePasta(fotosOrigem).baixar(caminho)));
      }
      const sql2 = postgres(urlDe(destino), { max: 1, onnotice: () => {} });
      try {
        expect(await fiscal(sql2)).toEqual(antes);
        expect(cli("aplicar-migracoes-ponto.mjs", ["--verificar"], { POSTGRES_URL_NON_POOLING: urlDe(destino) }).saida).toMatch(/Gate: GO \(versão fiscal 019\)/);
        // 17-18: nova batida no restaurado.
        const n4 = await bater(sql2, fotosDestino);
        expect([Number(n4.nsr), Number(n4.local_sequence), n4.status]).toEqual([4, 4, "registrado"]);
        expect(Number((await sql2`select ultimo_nsr from public.ponto_arp_contadores where estabelecimento_id = ${estab}`)[0].ultimo_nsr)).toBe(4);
      } finally { await sql2.end({ timeout: 5 }); }

      // Negativos.
      const destino2 = await banco();
      expect(cli("restaurar-backup-ponto.mjs", ["--pacote", pacote, `--confirmo-descartavel=${ident(destino2)}`], { ...restEnv, PONTO_RESTAURAR_URL: urlDe(destino2) }))
        .toMatchObject({ codigo: 2, saida: expect.stringMatching(/RECUPERAÇÃO APENAS DO BANCO \(não satisfaz o gate\)/) });
      const [umaBatida] = (await storagePasta(fotosOrigem).listar()).filter(i => i.caminho.startsWith("marcacoes/"));
      fs.writeFileSync(path.join(fotosOrigem, ...umaBatida.caminho.split("/")), jpeg("adulterada"));
      expect(cli("backup-ponto.mjs", ["--saida", saida, "--autorizado-por", "ci", "--fotos-de-pasta", fotosOrigem], { ...env, PONTO_BACKUP_KEY: chave }))
        .toMatchObject({ codigo: 3, saida: expect.stringMatching(/inconsistente.*hash divergente: 1/) });
      await sql.unsafe(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));     // alguém reaplicou a 017 por fora
      expect(cli("aplicar-migracoes-ponto.mjs", ["--verificar"], env)).toMatchObject({ codigo: 2, saida: expect.stringMatching(/Gate: NO-GO/) });
    } finally { await sql.end({ timeout: 5 }); }
  }, 300000);

  it("o SCRIPT DE DEPLOY de verdade (apply-ponto-eletronico.mjs): seguir, pular, bloquear e trava com prazo contra outra sessão", async () => {
    const deploy = (nome, extra = {}) => cli("apply-ponto-eletronico.mjs", [], { VERCEL_ENV: "production", POSTGRES_URL_NON_POOLING: urlDe(nome), ...extra });
    const funcoes = async s => (await s`select md5(string_agg(p.proname || md5(p.prosrc), '|' order by p.proname)) h from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and left(p.proname, 6) = 'ponto_'`)[0].h;
    const a = await banco(), b = await banco();
    const sqlA = postgres(urlDe(a), { max: 1, onnotice: () => {} }), sqlB = postgres(urlDe(b), { max: 1, onnotice: () => {} });
    try {
      await sqlA.unsafe(PAPEIS_SUPABASE); await sqlB.unsafe(PAPEIS_SUPABASE);
      // Hoje (sem livro, sem 019): GO/seguir e reaplica 016-018 como antes.
      expect(deploy(a)).toMatchObject({ codigo: 0, saida: expect.stringMatching(/trava_obtida[\s\S]*gate GO[\s\S]*migration aplicada/) });
      // Livro implantado: o deploy seguinte não reaplica nada.
      expect(cli("aplicar-migracoes-ponto.mjs", ["--aplicar", `--confirmo-banco=${ident(a)}`], { POSTGRES_URL_NON_POOLING: urlDe(a) }).codigo).toBe(0);
      const antes = await funcoes(sqlA);
      expect(deploy(a)).toMatchObject({ codigo: 0, saida: expect.stringMatching(/gate GO \(versão fiscal 018\)[\s\S]*nada reaplicado/) });
      expect(await funcoes(sqlA)).toBe(antes);
      // Outra sessão (deploy ou CLI) segurando a trava: o deploy espera o prazo e falha explícito, sem alterar nada.
      const poolOutra = postgres(urlDe(a), { max: 1, onnotice: () => {} }), outra = await poolOutra.reserve();
      try {
        await outra`select pg_advisory_lock(hashtextextended('arcd:ponto:migracoes', 0))`;
        const r = deploy(a, { PONTO_TRAVA_TIMEOUT_MS: "1500" });
        expect(r.codigo).not.toBe(0);
        expect(r.saida).toMatch(/trava_expirou[\s\S]*trava do livro de migrations não obtida/);
        expect(r.saida).not.toMatch(/gate /);
      } finally { outra.release(); await poolOutra.end({ timeout: 5 }); }
      // 019 aplicada SEM livro: o deploy é bloqueado e a 019 continua no banco.
      for (const f of ["016_create_ponto_eletronico.up.sql", "017_ponto_arp_estabelecimento_nsr.up.sql", "018_ponto_apropriacoes.up.sql", "019_ponto_integridade_fiscal.up.sql"]) await sqlB.unsafe(lerMigration(f));
      const r019 = deploy(b);
      expect(r019.codigo).not.toBe(0);
      expect(r019.saida).toMatch(/gate INTERVENCAO_HUMANA[\s\S]*deploy bloqueado pelo gate/);
      expect((await sqlB`select prosrc from pg_proc where proname = 'ponto_arp_registrar'`)[0].prosrc).toContain("fonteGravacao");
      // A saída nunca mostra a URL do banco.
      expect(r019.saida).not.toContain(urlDe(b));
    } finally { await sqlA.end({ timeout: 5 }); await sqlB.end({ timeout: 5 }); }
  }, 300000);
});
