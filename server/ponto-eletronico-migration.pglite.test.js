// @vitest-environment node
//
// Execução real (Postgres em memória via PGlite) da migration 016 - o app
// "Ponto de Obra". Prova no banco, não só no código da API, que:
// - marcação não pode ser alterada nem apagada (Portaria 671/2021);
// - a sequência NSR/hash por aparelho é garantida sob trava;
// - reenvio é idempotente e aparelho revogado não grava.

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

vi.setConfig({ testTimeout: 20000 });

const UP = fs.readFileSync(path.resolve(process.cwd(), "migrations/016_create_ponto_eletronico.up.sql"), "utf8");
const DOWN = fs.readFileSync(path.resolve(process.cwd(), "migrations/016_create_ponto_eletronico.down.sql"), "utf8");
const EMPRESA = "arcd";
const DISP = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const h = c => c.repeat(64);
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const marcacao = (nsr, hashAnterior, hash, extra = {}) => ({
  id: uuid(nsr), nsr, tipoRegistro: "ponto", employeeId: "emp-1", cpf: "12345678909",
  marcadoEm: `2026-10-01T10:0${nsr}:00.000Z`, horaConfiavel: true, metodo: "facial", confianca: 0.9,
  gps: { lat: -8.28, lng: -35.97, precisao: 10 }, hashAnterior, hash, ...extra,
});

let db;
const registrar = async lista => (await db.query(
  "select * from public.ponto_registrar_marcacoes($1, $2, $3::jsonb)", [EMPRESA, DISP, JSON.stringify(lista)],
)).rows[0];

beforeEach(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  end $$;`);
  await db.exec(UP);
  await db.query(
    "insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,$2,'obra-a','Portaria da obra',$3,'admin')",
    [EMPRESA, DISP, "a".repeat(64)],
  );
}, 30000);
afterEach(async () => { await db?.close(); });

describe("migration 016 - ponto eletrônico", () => {
  it("grava a sequência e avança o último NSR/hash do aparelho", async () => {
    const r = await registrar([marcacao(1, h("0"), h("1")), marcacao(2, h("1"), h("2"))]);
    expect(r).toMatchObject({ aceitas: 2, ultimo_hash: h("2"), erro: null });
    expect(Number(r.ultimo_nsr)).toBe(2);
    const { rows } = await db.query("select nsr, obra_id, employee_id from public.ponto_marcacoes order by nsr");
    expect(rows.map(x => [Number(x.nsr), x.obra_id, x.employee_id])).toEqual([[1, "obra-a", "emp-1"], [2, "obra-a", "emp-1"]]);
  });

  it("reenvio do mesmo lote não duplica (idempotente)", async () => {
    const lote = [marcacao(1, h("0"), h("1"))];
    await registrar(lote);
    const r = await registrar(lote);
    expect(r.aceitas).toBe(0);
    expect(r.erro).toBeNull();
    expect((await db.query("select count(*)::int as n from public.ponto_marcacoes")).rows[0].n).toBe(1);
  });

  it("recusa lacuna no NSR e cadeia quebrada, gravando só o que vem antes do erro", async () => {
    let r = await registrar([marcacao(1, h("0"), h("1")), marcacao(3, h("2"), h("3"))]);
    expect(r.aceitas).toBe(1);
    expect(r.erro).toMatch(/lacuna/);
    r = await registrar([marcacao(2, h("9"), h("2"))]);
    expect(r.aceitas).toBe(0);
    expect(r.erro).toMatch(/cadeia quebrada/);
  });

  it("marcação não pode ser alterada nem apagada, nem direto no banco", async () => {
    await registrar([marcacao(1, h("0"), h("1"))]);
    await expect(db.query("update public.ponto_marcacoes set marcado_em = now()")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from public.ponto_marcacoes")).rejects.toThrow(/append-only/);
  });

  it("aparelho revogado não grava mais nada", async () => {
    await db.query("update public.ponto_dispositivos set status='revogado'");
    const r = await registrar([marcacao(1, h("0"), h("1"))]);
    expect(r).toMatchObject({ aceitas: 0, erro: "aparelho revogado" });
  });

  it("ponto exige funcionário; acesso de terceiro exige terceirizado", async () => {
    const semFuncionario = { ...marcacao(1, h("0"), h("1")), employeeId: "" };
    await expect(registrar([semFuncionario])).rejects.toThrow();
    const terceiro = { ...marcacao(1, h("0"), h("1")), tipoRegistro: "acesso_terceiro", employeeId: "", terceiroId: "terc-1" };
    expect((await registrar([terceiro])).aceitas).toBe(1);
  });

  it("navegador (anon/authenticated) não acessa as tabelas nem a função", async () => {
    const { rows } = await db.query(`select has_table_privilege('authenticated','public.ponto_marcacoes','select') as ler,
      has_function_privilege('anon','public.ponto_registrar_marcacoes(text,uuid,jsonb)','execute') as executar`);
    expect(rows[0]).toEqual({ ler: false, executar: false });
  });

  it("cria o bucket de fotos privado quando o storage do Supabase existe (e rodar de novo não muda nada)", async () => {
    const outro = new PGlite({ extensions: { pgcrypto } });
    await outro.exec(`create role anon; create role authenticated; create role service_role;
      create schema storage;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
    await outro.exec(UP);
    await outro.exec(UP);
    const { rows } = await outro.query("select id, public from storage.buckets");
    expect(rows).toEqual([{ id: "ponto-obra", public: false }]);
    await outro.close();
  });

  it("a reversão roda limpa (antes de o app entrar em uso)", async () => {
    await db.exec(DOWN);
    const { rows } = await db.query("select to_regclass('public.ponto_marcacoes') as t");
    expect(rows[0].t).toBeNull();
  });
});
