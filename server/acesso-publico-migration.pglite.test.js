// @vitest-environment node
//
// Execução real (PGlite) da migration 019: com os privilégios padrão do
// Supabase (anon/authenticated com tudo), ela precisa fechar tabelas e funções
// SECURITY DEFINER, manter service_role funcionando e ser idempotente.

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";

vi.setConfig({ testTimeout: 20000 });

const UP = fs.readFileSync(path.resolve(process.cwd(), "migrations/019_fechar_acesso_publico.up.sql"), "utf8");
const DOWN = fs.readFileSync(path.resolve(process.cwd(), "migrations/019_fechar_acesso_publico.down.sql"), "utf8");
const PACOTE = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));

let db;
const um = async (sql, params) => (await db.query(sql, params)).rows[0];

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  end $$;`);
  // Estado de produção antes da 019: grants padrão do Supabase + políticas abertas.
  await db.exec(`
    create table public.company_app_data(company_id text, key text, value jsonb, primary key(company_id,key));
    create table public.kv_store(key text primary key, value jsonb);
    alter table public.company_app_data enable row level security;
    alter table public.kv_store enable row level security;
    create policy company_app_data_select_authenticated on public.company_app_data for select to authenticated using (company_id='arcd');
    create policy "Allow read kv_store" on public.kv_store for select using (true);
    grant all on public.company_app_data, public.kv_store to anon, authenticated, service_role;
    create function public.company_save_with_audit(p text) returns text language plpgsql security definer set search_path=public
      as $f$ begin insert into public.company_app_data values ('arcd', p, '{}'::jsonb); return p; end $f$;
    grant execute on function public.company_save_with_audit(text) to anon, authenticated, service_role;
    create function public.prevent_audit_event_mutation() returns trigger language plpgsql as $f$ begin raise exception 'imutavel'; end $f$;
    create function public.ponto_arp_imutavel() returns trigger language plpgsql as $f$ begin raise exception 'imutavel'; end $f$;
  `);
}, 30000);
afterEach(async () => { await db?.close(); });

const acesso = async () => um(`select
  has_table_privilege('anon','public.company_app_data','select') as anon_tabela,
  has_table_privilege('authenticated','public.company_app_data','insert') as auth_tabela,
  has_table_privilege('service_role','public.company_app_data','select,insert,update,delete') as svc_tabela,
  has_function_privilege('anon','public.company_save_with_audit(text)','execute') as anon_funcao,
  has_function_privilege('authenticated','public.company_save_with_audit(text)','execute') as auth_funcao,
  has_function_privilege('service_role','public.company_save_with_audit(text)','execute') as svc_funcao`);

describe("migration 019 - fecha o schema public", () => {
  it("antes dela, anon lê a base e grava pela função SECURITY DEFINER (o furo)", async () => {
    expect(await acesso()).toMatchObject({ anon_tabela: true, anon_funcao: true });
  });

  it("tira anon/authenticated de tabelas e funções e mantém service_role", async () => {
    await db.exec(UP);
    expect(await acesso()).toEqual({
      anon_tabela: false, auth_tabela: false, svc_tabela: true,
      anon_funcao: false, auth_funcao: false, svc_funcao: true,
    });
  });

  it("anon realmente não consegue ler nem chamar a função", async () => {
    await db.exec(UP);
    await db.exec("set role anon");
    await expect(db.query("select * from public.company_app_data")).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.company_save_with_audit('x')")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
    await db.exec("set role service_role");
    expect((await db.query("select public.company_save_with_audit('ok') as r")).rows[0].r).toBe("ok");
    await db.exec("reset role");
  });

  it("remove as políticas abertas e não toca nas funções da ARP", async () => {
    await db.exec(UP);
    const { n } = await um("select count(*)::int as n from pg_policies where schemaname='public'");
    expect(n).toBe(0);
    const cfg = async nome => (await um("select proconfig from pg_proc where proname=$1", [nome])).proconfig;
    expect(await cfg("prevent_audit_event_mutation")).toEqual(["search_path=public, pg_temp"]);
    expect(await cfg("ponto_arp_imutavel")).toBeNull();
  });

  it("tabela criada depois já nasce fechada (privilégios padrão)", async () => {
    await db.exec(UP);
    await db.exec("alter default privileges for role postgres in schema public grant all on tables to service_role");
    await db.exec("create table public.nova(id int)");
    const r = await um("select has_table_privilege('anon','public.nova','select') as anon");
    expect(r.anon).toBe(false);
  });

  it("é idempotente (roda a cada deploy) e o down reabre", async () => {
    await db.exec(UP);
    await db.exec(UP);
    expect((await acesso()).anon_funcao).toBe(false);
    await db.exec(DOWN);
    expect((await acesso()).anon_tabela).toBe(true);
  });

  it("o prebuild de produção aplica a 019 por último", () => {
    expect(PACOTE.scripts.prebuild.trim().endsWith("npm run acesso-publico:migrate")).toBe(true);
  });
});
