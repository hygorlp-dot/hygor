// @vitest-environment node
//
// Livro de migrations do Ponto de Obra num Postgres real em memória (PGlite).
// Cenário de produção completo: 016 -> 017 -> 018 (deploys antigos, que
// reaplicam tudo) -> implantação do livro -> 019 -> novo deploy. Depois do
// novo deploy, funções, permissões, triggers, hashes e registros continuam
// os da 019. E as recusas: arquivo alterado, estado parcial, migration
// posterior presente, falha no meio (desfaz tudo), script antigo bloqueado.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAPEIS_SUPABASE, lerMigration } from "../../server/ponto-eletronico/banco-pglite.test-helper.js";
import { verificarCadeiaFiscal } from "../../src/domains/ponto-eletronico/registro-fiscal.js";
import { adaptadorPglite } from "./adaptadores.mjs";
import { aplicar, guardaScriptAntigo, planejar, sha256Migracao } from "./livro.mjs";
import { validarMigracao } from "./validacao.mjs";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

const sha256 = v => createHash("sha256").update(v).digest("hex");
const ler = nome => JSON.parse(readFileSync(new URL(`./${nome}`, import.meta.url), "utf8")).migracoes;
const MANIFESTO = ler("manifesto.json");
const MANIFESTO_019 = ler("manifesto-com-019.json");
const C = "arcd", ZERO = "0".repeat(64);

let pg, db;
const q = async (sql, p = []) => (await pg.query(sql, p)).rows;
const lerArquivo = async arquivo => lerMigration(arquivo);
// O que o script ANTIGO faz a cada deploy (sem a guarda): reaplica 016-018.
const deployAntigo = async () => { for (const f of ["016_create_ponto_eletronico.up.sql", "017_ponto_arp_estabelecimento_nsr.up.sql", "018_ponto_apropriacoes.up.sql"]) await pg.exec(lerMigration(f)); };
// O mesmo script COM a guarda deste PR.
const deployAntigoComGuarda = async () => {
  const g = await guardaScriptAntigo(db);
  if (g.acao === "seguir") await deployAntigo();
  return g;
};

let disp, estab, seq, ultimo;
async function dadosReais() {
  disp = randomUUID(); estab = randomUUID(); seq = 0; ultimo = ZERO;
  await q("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,$2,'obra-1','Portaria',$3,'admin')", [C, disp, sha256(disp)]);
  await q("insert into public.ponto_estabelecimentos(company_id,id,nome,criado_por) values ($1,$2,'Matriz','admin')", [C, estab]);
  await q("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,'obra-1',$2,'admin')", [C, estab]);
  await bater(); await bater();
}
async function bater() {
  seq += 1;
  const localHash = sha256(`${disp}-${seq}`);
  const e = { formatVersion: 2, eventId: randomUUID(), deviceId: disp, localSequence: seq, localPreviousHash: ultimo, localHash,
    tipoRegistro: "ponto", employeeId: "emp-1", cpf: "12345678909", marcadoEm: new Date().toISOString(), horaConfiavel: true, metodo: "facial" };
  ultimo = localHash;
  const [r] = await q("select * from public.ponto_arp_registrar($1, $2, $3::jsonb, $4::jsonb)",
    [C, disp, JSON.stringify([e]), JSON.stringify({ serverTime: new Date().toISOString(), source: "host", status: "nao_verificada", toleranciaMs: 30000 })]);
  return r;
}

// Retrato do que não pode mudar num deploy: corpo e config de todas as
// funções do ponto, permissões, triggers e o conteúdo de cada tabela.
async function retrato() {
  const [funcoes] = await q(`select md5(string_agg(p.proname || coalesce(array_to_string(p.proconfig, ','), '') || pg_get_functiondef(p.oid), '|' order by p.proname)) h
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ponto%' and p.proname not like 'ponto_migracoes%'`);
  const [grants] = await q(`select md5(string_agg(grantee || ':' || table_name || ':' || privilege_type, '|' order by 1)) h from (
    select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name like 'ponto%' and table_name not like 'ponto_migracoes%') x`);
  const [rotinas] = await q(`select md5(string_agg(grantee || ':' || routine_name || ':' || privilege_type, '|' order by 1)) h from (
    select grantee, routine_name, privilege_type from information_schema.role_routine_grants where routine_schema = 'public' and routine_name like 'ponto%') x`);
  const [triggers] = await q(`select md5(string_agg(tgname || ':' || tgenabled::text, '|' order by tgname)) h from pg_trigger where not tgisinternal and tgname like 'ponto%' and tgname not like 'ponto_migracoes%'`);
  const dados = {};
  for (const t of ["ponto_dispositivos", "ponto_eventos", "ponto_arp_registros", "ponto_arp_contadores", "ponto_estabelecimentos", "ponto_estabelecimentos_auditoria", "ponto_marcacoes"]) {
    const [l] = await q(`select to_regclass('public.${t}') is not null as existe`);
    dados[t] = l.existe ? (await q(`select count(*)::int n, md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) h from public.${t} x`))[0] : null;
  }
  return { funcoes: funcoes.h, grants: grants.h, rotinas: rotinas.h, triggers: triggers.h, dados };
}
const cadeiaOk = async () => verificarCadeiaFiscal((await q(`select r.*, e.cpf, e.employee_id, e.marcado_em_texto, e.local_hash from public.ponto_arp_registros r
  join public.ponto_eventos e using (company_id, event_id) where r.estabelecimento_id = $1 order by r.nsr`, [estab])).map(r => ({
  estabelecimentoId: r.estabelecimento_id, nsr: Number(r.nsr), eventId: r.event_id, tipoRegistro: "ponto", cpf: r.cpf, employeeId: r.employee_id,
  marcadoEm: r.marcado_em_texto, gravadoEm: r.gravado_em_texto, deviceId: r.dispositivo_id, localSequence: Number(r.local_sequence),
  localHash: r.local_hash, fiscalPreviousHash: r.fiscal_previous_hash, fiscalHash: r.fiscal_hash,
})), async t => sha256(t));

beforeEach(async () => {
  pg = new PGlite({ extensions: { pgcrypto } });
  db = adaptadorPglite(pg);
  await pg.exec(PAPEIS_SUPABASE);
});
afterEach(async () => { await pg?.close(); });

describe("manifestos", () => {
  it("SHA-256 dos manifestos confere com os arquivos; produção tem 016-018 (019 é preliminar)", () => {
    for (const m of [...MANIFESTO, ...MANIFESTO_019]) expect(sha256Migracao(lerMigration(m.arquivo))).toBe(m.sha256);
    expect(MANIFESTO.map(m => m.arquivo.slice(0, 3))).toEqual(["016", "017", "018"]);
    expect(MANIFESTO_019.map(m => m.arquivo.slice(0, 3))).toEqual(["016", "017", "018", "019"]);
    expect(sha256Migracao("a\r\nb")).toBe(sha256Migracao("a\nb"));
  });
});

describe("cenário completo de produção", () => {
  it("016 -> 017 -> 018 -> livro -> 019 -> novo deploy: tudo continua na 019", async () => {
    // Deploys antigos (cada um reaplica tudo) e dados reais (2 NSR).
    await deployAntigo(); await deployAntigo();
    await dadosReais();
    expect(await deployAntigoComGuarda()).toMatchObject({ acao: "seguir" });      // hoje: igual a antes
    const antesDoLivro = await retrato();

    // Planejar não muda nada (nem cria o livro).
    const plano = await planejar({ db, manifesto: MANIFESTO, lerArquivo });
    expect(plano).toMatchObject({ livroExiste: false });
    expect(plano.passos.map(p => p.acao)).toEqual(["registrar_existente", "registrar_existente", "registrar_existente"]);
    expect((await q("select to_regclass('public.ponto_migracoes_aplicadas') t"))[0].t).toBeNull();

    // Implantação do livro: 016-018 só REGISTRADAS (nada reexecutado).
    const r1 = await aplicar({ db, manifesto: MANIFESTO, lerArquivo, origem: "teste:implantacao" });
    expect(r1.passos.map(p => p.acao)).toEqual(["registrar_existente", "registrar_existente", "registrar_existente"]);
    const depoisDoLivro = await retrato();
    expect(depoisDoLivro.funcoes).toBe(antesDoLivro.funcoes);
    expect(depoisDoLivro.dados).toEqual(antesDoLivro.dados);
    expect(await q("select arquivo, modo, origem from public.ponto_migracoes_aplicadas order by arquivo")).toEqual(
      MANIFESTO.map(m => ({ arquivo: m.arquivo, modo: "registrada_existente", origem: "teste:implantacao" })));

    // Script antigo agora não reaplica nada.
    expect(await deployAntigoComGuarda()).toMatchObject({ acao: "pular" });

    // 019 pela janela autorizada (manifesto com a 019).
    const r2 = await aplicar({ db, manifesto: MANIFESTO_019, lerArquivo, origem: "teste:janela-019" });
    expect(r2.passos.map(p => p.acao)).toEqual(["ja_aplicada", "ja_aplicada", "ja_aplicada", "aplicar"]);
    expect((await validarMigracao(db, "019_ponto_integridade_fiscal.up.sql")).completa).toBe(true);
    const na019 = await retrato();
    expect(na019.dados.ponto_arp_registros).toEqual(antesDoLivro.dados.ponto_arp_registros);   // nada reescrito
    expect(na019.dados.ponto_eventos).toEqual(antesDoLivro.dados.ponto_eventos);

    // NOVO DEPLOY: script antigo com guarda + livro (já com a 019 no manifesto).
    expect(await deployAntigoComGuarda()).toMatchObject({ acao: "pular" });
    const r3 = await aplicar({ db, manifesto: MANIFESTO_019, lerArquivo, origem: "teste:deploy-seguinte" });
    expect(r3.passos.map(p => p.acao)).toEqual(["ja_aplicada", "ja_aplicada", "ja_aplicada", "ja_aplicada"]);
    expect(await retrato()).toEqual(na019);                                   // funções, permissões, triggers e dados idênticos

    // A ARP em produção continua sendo a da 019 e a cadeia segue.
    const r = await bater();
    expect(Number(r.nsr)).toBe(3);
    const [ev] = await q("select evidencia_hora from public.ponto_arp_registros where nsr = 3");
    expect(ev.evidencia_hora.arp.versao).toBe(19);
    expect(await cadeiaOk()).toEqual({ ok: true, erro: null });
  });

  it("o perigo que a guarda evita: reaplicar a 017 depois da 019 reescreve a ARP com a versão antiga", async () => {
    await deployAntigo();
    await pg.exec(lerMigration("019_ponto_integridade_fiscal.up.sql"));
    expect((await validarMigracao(db, "019_ponto_integridade_fiscal.up.sql")).completa).toBe(true);
    await pg.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));     // o que o script antigo faria
    const v = await validarMigracao(db, "019_ponto_integridade_fiscal.up.sql");
    expect(v).toMatchObject({ completa: false, parcial: true });
    expect(v.faltando).toEqual(expect.arrayContaining(["corpo de ponto_arp_registrar na versão desta migration", "corpo de ponto_dispositivo_protegido na versão desta migration"]));
  });

  it("019 aplicada à mão ANTES do livro: script antigo bloqueia o deploy; o livro registra a 019 sem reexecutar nada", async () => {
    await deployAntigo();
    await dadosReais();
    await pg.exec(lerMigration("019_ponto_integridade_fiscal.up.sql"));
    expect(await deployAntigoComGuarda()).toMatchObject({ acao: "bloquear" });
    const antes = await retrato();
    const r = await aplicar({ db, manifesto: MANIFESTO_019, lerArquivo, origem: "teste" });
    expect(r.passos.map(p => p.acao)).toEqual(["registrar_existente", "registrar_existente", "registrar_existente", "registrar_existente"]);
    expect((await retrato()).funcoes).toBe(antes.funcoes);
  });
});

describe("recusas do livro", () => {
  it("arquivo alterado depois de aplicado: recusa e não executa nada", async () => {
    await deployAntigo();
    await aplicar({ db, manifesto: MANIFESTO, lerArquivo, origem: "teste" });
    const adulterado = async a => (a.startsWith("017") ? `${lerMigration(a)}\n-- edição posterior` : lerMigration(a));
    await expect(aplicar({ db, manifesto: MANIFESTO, lerArquivo: adulterado, origem: "teste" })).rejects.toThrow(/017_.*mudou.*não confere com o manifesto/);
    // Manifesto atualizado junto (alguém "corrigiu" o SHA): o livro ainda recusa.
    const manifesto = MANIFESTO.map(m => (m.arquivo.startsWith("017") ? { ...m, sha256: sha256Migracao(`${lerMigration(m.arquivo)}\n-- edição posterior`) } : m));
    await expect(aplicar({ db, manifesto, lerArquivo: adulterado, origem: "teste" })).rejects.toThrow(/já aplicada com outro conteúdo/);
  });

  it("estado parcial (019 reescrita pela 017) e migration posterior presente: recusa", async () => {
    await deployAntigo();
    await pg.exec(lerMigration("019_ponto_integridade_fiscal.up.sql"));
    await pg.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));
    await expect(planejar({ db, manifesto: MANIFESTO_019, lerArquivo })).rejects.toThrow(/019_.*estado PARCIAL/);
    // Banco só com 016 + 019 parcial: não executa 017 por cima da 019.
    const so016 = new PGlite({ extensions: { pgcrypto } });
    try {
      await so016.exec(PAPEIS_SUPABASE);
      await so016.exec(lerMigration("016_create_ponto_eletronico.up.sql"));
      await so016.exec("create table public.ponto_estabelecimentos_auditoria(id int)");
      await expect(planejar({ db: adaptadorPglite(so016), manifesto: MANIFESTO_019, lerArquivo })).rejects.toThrow(/017_.*não executo.*019_.*já está no banco/);
    } finally { await so016.close(); }
  });

  it("banco vazio: aplica 016-018 em ordem, cada uma numa transação com lock_timeout e statement_timeout", async () => {
    const limites = [];
    const espiao = { ...db, exec: async t => { if (/set local lock_timeout/.test(t)) limites.push(t); return db.exec(t); } };
    const r = await aplicar({ db: espiao, manifesto: MANIFESTO, lerArquivo, origem: "teste" });
    expect(r.passos.map(p => p.acao)).toEqual(["aplicar", "aplicar", "aplicar"]);
    expect(limites).toHaveLength(3);
    expect(limites[0]).toMatch(/lock_timeout = '5s'.*statement_timeout = '120s'/);
    expect((await q("select modo from public.ponto_migracoes_aplicadas")).every(l => l.modo === "aplicada")).toBe(true);
  });

  it("falha no meio de uma migration: desfaz a migration inteira e não registra", async () => {
    await deployAntigo();
    await aplicar({ db, manifesto: MANIFESTO, lerArquivo, origem: "teste" });
    const quebrada = async a => (a.startsWith("019") ? `${lerMigration(a)}\nselect 1/0;` : lerMigration(a));
    const manifesto = MANIFESTO_019.map(m => (m.arquivo.startsWith("019") ? { ...m, sha256: sha256Migracao(`${lerMigration(m.arquivo)}\nselect 1/0;`) } : m));
    await expect(aplicar({ db, manifesto, lerArquivo: quebrada, origem: "teste" })).rejects.toThrow(/division by zero/);
    expect((await q("select count(*)::int n from public.ponto_migracoes_aplicadas"))[0].n).toBe(3);
    expect((await validarMigracao(db, "019_ponto_integridade_fiscal.up.sql")).presentes).toEqual([]);   // nada da 019 ficou
  });

  it("deriva: 019 registrada no livro mas sobrescrita por fora (017 reaplicada sem livro) -> o livro recusa seguir", async () => {
    await deployAntigo();
    await aplicar({ db, manifesto: MANIFESTO_019, lerArquivo, origem: "teste" });
    await pg.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));     // alguém rodou a 017 na mão
    await expect(planejar({ db, manifesto: MANIFESTO_019, lerArquivo })).rejects.toThrow(/019_.*registrada no livro, mas o banco não confere.*corpo de ponto_arp_registrar/);
  });

  it("livro é append-only e fechado para anon/authenticated", async () => {
    await aplicar({ db, manifesto: MANIFESTO, lerArquivo, origem: "teste" });
    await expect(q("update public.ponto_migracoes_aplicadas set origem = 'x'")).rejects.toThrow(/append-only/);
    await expect(q("delete from public.ponto_migracoes_aplicadas")).rejects.toThrow(/append-only/);
    await expect(q("truncate public.ponto_migracoes_aplicadas")).rejects.toThrow(/append-only/);
    const [p] = await q("select has_table_privilege('anon', 'public.ponto_migracoes_aplicadas', 'select') a, has_table_privilege('service_role', 'public.ponto_migracoes_aplicadas', 'insert') s");
    expect(p).toEqual({ a: false, s: false });
  });
});

describe("livro ainda NÃO está no deploy", () => {
  it("o prebuild continua no script antigo (com a guarda); ligar o livro ao deploy exige autorização e muda este teste de propósito", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(pkg.scripts.prebuild).toContain("npm run ponto-eletronico:migrate");
    expect(pkg.scripts.prebuild).not.toContain("ponto-eletronico:livro");
    expect(pkg.scripts["ponto-eletronico:migrate"]).toBe("node scripts/apply-ponto-eletronico.mjs");
    const antigo = readFileSync(new URL("../apply-ponto-eletronico.mjs", import.meta.url), "utf8");
    expect(antigo).toMatch(/guardaScriptAntigo/);
    expect(antigo.indexOf("guardaScriptAntigo(adaptadorPostgres(sql))")).toBeLessThan(antigo.indexOf("016_create_ponto_eletronico.up.sql"));
  });
});

