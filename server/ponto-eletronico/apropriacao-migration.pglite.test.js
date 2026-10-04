// @vitest-environment node
//
// Contrato da migration 018 (apropriação de jornada por obra) num Postgres
// real em memória (PGlite). A 018 fica FORA da ARP: não toca ponto_eventos,
// ponto_arp_registros nem as funções da 017. Aqui se prova, no banco:
// banco novo, atualização 016 → 017 → 018 com dados, sobreposição, controle
// de versão, auditoria imutável, cancelamento, permissões e reversão.
import { afterEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PAPEIS_SUPABASE, lerMigration } from "./banco-pglite.test-helper.js";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const EMPRESA = "arcd";
const UP = n => lerMigration({ 16: "016_create_ponto_eletronico.up.sql", 17: "017_ponto_arp_estabelecimento_nsr.up.sql", 18: "018_ponto_apropriacoes.up.sql" }[n]);
const DOWN_018 = lerMigration("018_ponto_apropriacoes.down.sql");

let db;
afterEach(async () => { await db?.close(); db = null; });

async function banco(ate = 18) {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(PAPEIS_SUPABASE);
  for (const n of [16, 17, 18].filter(n => n <= ate)) await db.exec(UP(n));
  return db;
}
const linhas = async (sql, p = []) => (await db.query(sql, p)).rows;
const salvar = async ({ id = null, employee = "e1", data = "2026-10-01", inicio, fim, obra = "obra-a", origem = "manual", resp = "u-adm", motivo = null, versao = null }) =>
  (await linhas("select * from public.ponto_apropriacao_salvar($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
    [EMPRESA, id, employee, data, inicio, fim, obra, origem, resp, motivo, versao]))[0];
const cancelar = async ({ id, resp = "u-adm", motivo, versao }) =>
  (await linhas("select * from public.ponto_apropriacao_cancelar($1, $2, $3, $4, $5)", [EMPRESA, id, resp, motivo, versao]))[0];
const MANHA = { inicio: "2026-10-01T10:00:00Z", fim: "2026-10-01T14:00:00Z" };
const TARDE = { inicio: "2026-10-01T15:00:00Z", fim: "2026-10-01T19:00:00Z" };
const existe = async (tipo, nome) => (await linhas(tipo === "tabela"
  ? "select to_regclass($1) is not null as ok" : "select exists(select 1 from pg_proc where proname = $1) as ok", [tipo === "tabela" ? `public.${nome}` : nome]))[0].ok;

describe("migration 018 - apropriação por obra", () => {
  it("banco novo: 016 + 017 + 018 criam tabelas, funções, RLS e não mexem na ARP", async () => {
    await banco();
    for (const t of ["ponto_apropriacoes", "ponto_apropriacoes_auditoria", "ponto_eventos", "ponto_arp_registros"]) expect(await existe("tabela", t)).toBe(true);
    for (const f of ["ponto_apropriacao_salvar", "ponto_apropriacao_cancelar", "ponto_arp_registrar"]) expect(await existe("funcao", f)).toBe(true);
    const rls = await linhas("select relname, relrowsecurity from pg_class where relname in ('ponto_apropriacoes','ponto_apropriacoes_auditoria') order by relname");
    expect(rls.every(r => r.relrowsecurity)).toBe(true);
    // A 018 não cria nada que referencie a ARP.
    const fks = await linhas(`select conrelid::regclass::text tabela, confrelid::regclass::text alvo from pg_constraint
      where contype = 'f' and conrelid::regclass::text like '%apropriac%'`);
    expect(fks.every(f => !/arp|eventos|marcacoes/.test(f.alvo))).toBe(true);
  });

  it("016 → 017 → 018 sobre banco com dados: nada da ARP muda e a 018 é idempotente", async () => {
    await banco(17);
    await db.query("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,gen_random_uuid(),'obra-a','Portaria',$2,'admin')", [EMPRESA, "a".repeat(64)]);
    const antes = await linhas("select * from public.ponto_dispositivos");
    const funcoesArp = async () => linhas("select proname, md5(prosrc) h from pg_proc where proname like 'ponto_arp%' order by proname");
    const arpAntes = await funcoesArp();
    await db.exec(UP(18));
    await db.exec(UP(18));                                                     // de novo: forward-only e idempotente
    expect(await linhas("select * from public.ponto_dispositivos")).toEqual(antes);
    expect(await funcoesArp()).toEqual(arpAntes);
    const c = await linhas("select col_description('public.ponto_eventos'::regclass, attnum) d from pg_attribute where attrelid = 'public.ponto_eventos'::regclass and attname = 'obra_id'");
    expect(c[0].d).toMatch(/Obra de CAPTURA/);
  });

  it("sobreposição: o mesmo funcionário não tem dois intervalos ativos que se cruzam; vários no dia sim", async () => {
    await banco();
    await salvar({ ...MANHA, obra: "obra-a" });
    await salvar({ ...TARDE, obra: "obra-b" });                                // B → outra obra no mesmo dia: ok
    await expect(salvar({ inicio: "2026-10-01T13:00:00Z", fim: "2026-10-01T16:00:00Z", obra: "obra-c" })).rejects.toThrow(/sobrepõe/);
    await salvar({ employee: "e2", ...MANHA, obra: "obra-c" });                // outro funcionário: independente
    await salvar({ inicio: "2026-10-01T14:00:00Z", fim: "2026-10-01T15:00:00Z", obra: "obra-c" }); // [) encosta sem cruzar
    await expect(salvar({ inicio: MANHA.fim, fim: MANHA.inicio })).rejects.toThrow();            // fim antes do início
    await expect(salvar({ inicio: "2026-10-01T00:00:00Z", fim: "2026-10-02T01:00:00Z" })).rejects.toThrow(); // > 24 h
    expect(await linhas("select count(*)::int n from public.ponto_apropriacoes where employee_id = 'e1'")).toEqual([{ n: 3 }]);
  });

  it("versão: alteração exige a versão atual e motivo; a outra pessoa recebe conflito", async () => {
    await banco();
    const a = await salvar({ ...MANHA });
    expect(a.version).toBe(1);
    await expect(salvar({ id: a.id, ...MANHA, obra: "obra-b", motivo: "", versao: 1 })).rejects.toThrow(/motivo/);
    const b = await salvar({ id: a.id, ...MANHA, obra: "obra-b", motivo: "estava na obra B", versao: 1 });
    expect(b.version).toBe(2);
    await expect(salvar({ id: a.id, ...MANHA, obra: "obra-c", motivo: "outra pessoa", versao: 1 })).rejects.toThrow(/outra pessoa \(versão 2\)/);
    await expect(salvar({ id: a.id, employee: "e2", ...MANHA, motivo: "x", versao: 2 })).rejects.toThrow(/outro funcionário/);
  });

  it("auditoria: criação e alteração registram antes, depois, quem e por quê; a trilha não muda nem se apaga", async () => {
    await banco();
    const a = await salvar({ ...MANHA, resp: "u-enc" });
    await salvar({ id: a.id, ...MANHA, obra: "obra-b", resp: "u-adm", motivo: "B → C com motivo", versao: 1 });
    const trilha = await linhas("select acao, antes, depois, responsavel_id, motivo from public.ponto_apropriacoes_auditoria where apropriacao_id = $1 order by em, acao desc", [a.id]);
    expect(trilha.map(t => [t.acao, t.responsavel_id])).toEqual([["criada", "u-enc"], ["alterada", "u-adm"]]);
    expect(trilha[0].antes).toBeNull();
    expect([trilha[1].antes.obra_apropriada_id, trilha[1].depois.obra_apropriada_id, trilha[1].motivo]).toEqual(["obra-a", "obra-b", "B → C com motivo"]);
    await expect(db.query("update public.ponto_apropriacoes_auditoria set motivo = 'x'")).rejects.toThrow();
    await expect(db.query("delete from public.ponto_apropriacoes_auditoria")).rejects.toThrow();
    await expect(db.query("truncate public.ponto_apropriacoes_auditoria")).rejects.toThrow();
    // Escrita direta (fora das funções) é recusada mesmo para o dono do banco.
    await expect(db.query("update public.ponto_apropriacoes set obra_apropriada_id = 'obra-z'")).rejects.toThrow(/só muda pelas funções/);
    await expect(db.query("insert into public.ponto_apropriacoes_auditoria(company_id, apropriacao_id, acao, depois, responsavel_id) values ($1, $2, 'criada', '{}', 'x')", [EMPRESA, a.id])).rejects.toThrow();
  });

  it("cancelamento: exige motivo e versão, é auditado, libera o intervalo e não apaga a linha", async () => {
    await banco();
    const a = await salvar({ ...MANHA });
    await expect(cancelar({ id: a.id, motivo: " ", versao: 1 })).rejects.toThrow(/motivo/);
    await expect(cancelar({ id: a.id, motivo: "lançado errado", versao: 9 })).rejects.toThrow(/versão 1/);
    expect(await cancelar({ id: a.id, motivo: "lançado errado", versao: 1 })).toMatchObject({ version: 2 });
    await expect(cancelar({ id: a.id, motivo: "de novo", versao: 2 })).rejects.toThrow(/já cancelada/);
    await expect(salvar({ id: a.id, ...MANHA, motivo: "x", versao: 2 })).rejects.toThrow(/cancelada não pode ser alterada/);
    await salvar({ ...MANHA, obra: "obra-b" });                                 // o intervalo ficou livre
    expect(await linhas("select status from public.ponto_apropriacoes order by criado_em, status")).toEqual([{ status: "cancelada" }, { status: "ativa" }]);
    expect((await linhas("select acao from public.ponto_apropriacoes_auditoria where apropriacao_id = $1", [a.id])).map(r => r.acao).sort()).toEqual(["cancelada", "criada"]);
    await expect(db.query("delete from public.ponto_apropriacoes where id = $1", [a.id])).rejects.toThrow();
  });

  it("permissões: anon e authenticated sem acesso; service_role só lê e executa as funções", async () => {
    await banco();
    const tab = async (papel, t, priv) => (await linhas("select has_table_privilege($1, $2, $3) ok", [papel, `public.${t}`, priv]))[0].ok;
    const fn = async (papel, assinatura) => (await linhas("select has_function_privilege($1, $2, 'execute') ok", [papel, assinatura]))[0].ok;
    const SALVAR = "public.ponto_apropriacao_salvar(text, uuid, text, date, timestamptz, timestamptz, text, text, text, text, integer)";
    const CANCELAR = "public.ponto_apropriacao_cancelar(text, uuid, text, text, integer)";
    for (const papel of ["anon", "authenticated"]) {
      for (const t of ["ponto_apropriacoes", "ponto_apropriacoes_auditoria"]) for (const p of ["select", "insert", "update", "delete"]) expect(await tab(papel, t, p)).toBe(false);
      expect(await fn(papel, SALVAR)).toBe(false);
      expect(await fn(papel, CANCELAR)).toBe(false);
    }
    for (const t of ["ponto_apropriacoes", "ponto_apropriacoes_auditoria"]) {
      expect(await tab("service_role", t, "select")).toBe(true);
      for (const p of ["insert", "update", "delete"]) expect(await tab("service_role", t, p)).toBe(false);
    }
    expect(await fn("service_role", SALVAR)).toBe(true);
    expect(await fn("service_role", CANCELAR)).toBe(true);
  });

  it("reversão: o down só roda sem apropriações e deixa a 017 intacta; reaplicar a 018 funciona", async () => {
    await banco();
    await salvar({ ...MANHA });
    await expect(db.exec(DOWN_018)).rejects.toThrow(/reversão da 018 recusada/);
    expect(await existe("tabela", "ponto_apropriacoes")).toBe(true);

    await db.close();
    await banco();                                                              // banco sem apropriações
    await db.exec(DOWN_018);
    expect(await existe("tabela", "ponto_apropriacoes")).toBe(false);
    expect(await existe("funcao", "ponto_apropriacao_salvar")).toBe(false);
    expect(await existe("tabela", "ponto_arp_registros")).toBe(true);
    expect(await existe("funcao", "ponto_arp_registrar")).toBe(true);
    await db.exec(UP(18));
    expect((await salvar({ ...MANHA })).version).toBe(1);
  });
});
