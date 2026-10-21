// @vitest-environment node
//
// Execução real (PGlite) das migrations aplicadas por
// scripts/apply-manutencao-banco.mjs:
// - 006: arquivar/restaurar a quinzena de ponto numa transação só;
// - 020: tira o índice único duplicado de financial_events, e a 004 (que
//   roda em todo deploy) não o recria mais.

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";

vi.setConfig({ testTimeout: 20000 });

const ler = nome => fs.readFileSync(path.resolve(process.cwd(), "migrations", nome), "utf8");
const M004 = ler("004_financial_events_projection_conflict.up.sql");
const M006 = ler("006_attendance_archive_transaction.up.sql");
const M020 = ler("020_remover_indice_duplicado_financial_events.up.sql");
const PACOTE = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));

let db;
const um = async (sql, params) => (await db.query(sql, params)).rows[0];
const indicesUnicos = async () => (await um(`select count(*)::int as n from pg_index
  where indrelid='public.financial_events'::regclass and indisunique and indnatts=4`)).n;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  end $$;`);
  // Estado de produção: tabelas do bootstrap, com a restrição única já declarada.
  await db.exec(`
    create table public.company_app_data(company_id text, key text, value jsonb, updated_at timestamptz default now(), updated_by uuid, primary key(company_id,key));
    create table public.audit_events(id bigserial primary key, company_id text, aggregate_type text, aggregate_id text, action text, actor_id text, actor_name text,
      correlation_id uuid, before_snapshot jsonb, after_snapshot jsonb, source text, created_at timestamptz default now());
    create table public.financial_events(id uuid primary key default gen_random_uuid(), company_id text, event_type text, source_type text, source_id text,
      payload jsonb, created_at timestamptz default now(), unique(company_id,event_type,source_type,source_id));
    create table public.journal_entries(id uuid primary key default gen_random_uuid(), event_id uuid references public.financial_events(id));
    insert into public.company_app_data(company_id,key,value,updated_at) values ('arcd','arced_ponto_v1','{"attendance":{"e1":{}}}','2026-10-21T10:00:00Z');
  `);
}, 30000);
afterEach(async () => { await db?.close(); });

const arquivar = (papel, esperado = "2026-10-21T10:00:00Z") => um(
  `select * from public.attendance_archive_transaction('arcd','arced_ponto_v1','arced_ponto_v1__arquivo__2026-10-a',$1::timestamptz,
    '{"attendance":{}}'::jsonb,'{"attendance":{"e1":{}}}'::jsonb,'u1','Ana',$2,gen_random_uuid(),'{}'::jsonb,'{}'::jsonb)`, [esperado, papel]);

describe("006 - arquivo da quinzena de ponto", () => {
  beforeEach(async () => { await db.exec(M006); });

  it("arquiva numa transação: cria o arquivo, atualiza o principal e audita", async () => {
    const r = await arquivar("rh");
    expect(r).toMatchObject({ applied: true, reason: "" });
    const arquivo = await um("select value from public.company_app_data where key='arced_ponto_v1__arquivo__2026-10-a'");
    expect(arquivo.value).toEqual({ attendance: { e1: {} } });
    expect((await um("select value from public.company_app_data where key='arced_ponto_v1'")).value).toEqual({ attendance: {} });
    expect((await um("select action from public.audit_events")).action).toBe("attendance_archive");
  });

  it("recusa versão desatualizada, arquivo repetido e perfil sem permissão", async () => {
    expect(await arquivar("admin", "2000-01-01T00:00:00Z")).toMatchObject({ applied: false, reason: "concurrent_update" });
    await expect(arquivar("engenheiro")).rejects.toThrow(/forbidden_attendance_archive/);
    await arquivar("admin");
    const atual = (await um("select updated_at from public.company_app_data where key='arced_ponto_v1'")).updated_at;
    expect(await arquivar("admin", atual.toISOString())).toMatchObject({ applied: false, reason: "archive_exists" });
  });

  it("restaura só com admin e apaga o arquivo", async () => {
    await arquivar("admin");
    const atual = (await um("select updated_at from public.company_app_data where key='arced_ponto_v1'")).updated_at;
    const restaurar = papel => um(`select * from public.attendance_restore_transaction('arcd','arced_ponto_v1','arced_ponto_v1__arquivo__2026-10-a',$1::timestamptz,
      '{"attendance":{"e1":{}}}'::jsonb,'u1','Ana',$2,gen_random_uuid(),'{}'::jsonb,'{}'::jsonb)`, [atual.toISOString(), papel]);
    await expect(restaurar("rh")).rejects.toThrow(/forbidden_attendance_restore/);
    expect(await restaurar("admin")).toMatchObject({ applied: true });
    expect((await um("select count(*)::int as n from public.company_app_data where key like '%__arquivo__%'")).n).toBe(0);
  });

  it("só service_role executa", async () => {
    const r = await um(`select has_function_privilege('anon','public.attendance_archive_transaction(text,text,text,timestamptz,jsonb,jsonb,text,text,text,uuid,jsonb,jsonb)','execute') as anon,
      has_function_privilege('service_role','public.attendance_archive_transaction(text,text,text,timestamptz,jsonb,jsonb,text,text,text,uuid,jsonb,jsonb)','execute') as svc`);
    expect(r).toEqual({ anon: false, svc: true });
  });
});

describe("020 - índice duplicado de financial_events", () => {
  it("004 antiga criava o duplicado; a 020 remove e a 004 nova não recria", async () => {
    await db.exec("create unique index uq_financial_events_canonical_source on financial_events(company_id, event_type, source_type, source_id)");
    expect(await indicesUnicos()).toBe(2);
    await db.exec(M020);
    expect(await indicesUnicos()).toBe(1);
    await db.exec(M004);
    await db.exec(M020);
    expect(await indicesUnicos()).toBe(1);
  });

  it("instalação sem a restrição: a 004 cria a chave e a 020 a mantém", async () => {
    const { conname } = await um("select conname from pg_constraint where conrelid='public.financial_events'::regclass and contype='u'");
    await db.exec(`alter table financial_events drop constraint ${conname}`);
    expect(await indicesUnicos()).toBe(0);
    await db.exec(M004);
    await db.exec(M020);
    expect(await indicesUnicos()).toBe(1);
  });

  it("o prebuild aplica a manutenção antes da 019", () => {
    const passos = PACOTE.scripts.prebuild.split("&&").map(s => s.trim());
    expect(passos.indexOf("npm run manutencao-banco:migrate")).toBeGreaterThan(passos.indexOf("npm run financial:migrate-shadow"));
    expect(passos.at(-1)).toBe("npm run acesso-publico:migrate");
  });
});
