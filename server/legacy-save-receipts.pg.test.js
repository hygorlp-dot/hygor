// @vitest-environment node
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRequestedDreProjectionRows } from "./dre-projection.js";
import { camadaSupabase } from "./ponto-eletronico/banco-pglite.test-helper.js";

const url = process.env.PONTO_PG_URL;
const database = `legacy_save_test_${randomUUID().replaceAll("-", "")}`;
const core = "arced_ponto_v1";
const initialVersion = "2026-11-01T12:00:00Z";
const seed = {
  usuarios: [{ id: "admin", role: "admin", active: true, authUserId: "token-admin", email: "admin@test.local" }],
  obras: [{ id: "obra-a", name: "Obra A" }],
  materiais: [{ id: "m1", descricao: "Cimento" }],
};
const expense = { id: "corp-1", descricao: "Licença", competencia: "2026-11", valor: 123.45, status: "ativo" };
const state = vi.hoisted(() => ({ sql: null, db: null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (...args) => state.db.from(...args),
    rpc: (...args) => state.db.rpc(...args),
    auth: { getUser: async () => ({ data: { user: { id: "token-admin", email: "admin@test.local" } } }) },
  }),
}));
vi.mock("./pg-conexao.js", () => ({ comSql: callback => callback(state.sql) }));

let root, sql, handler;
const loadMigration = async name => sql.unsafe(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8"));
const count = async () => (await sql`
  select (select count(*)::int from audit_events) as events,
         (select count(*)::int from legacy_save_receipts) as receipts
`)[0];
const stored = async () => (await sql`select value, updated_at::text as version from company_app_data
  where company_id='arcd' and key=${core}`)[0];

async function send(body) {
  let status, json;
  const res = {
    status(code) { status = code; return res; },
    json(value) { json = JSON.parse(JSON.stringify(value)); },
  };
  await handler({ body: { accessToken: "token", ...body }, query: {}, headers: {} }, res);
  return { status, body: json };
}

function request(action, financial, operationId) {
  const changes = financial ? { despesasEmpresa: [expense] } : { materiais: [{ id: "m1", descricao: "Cimento CP II" }] };
  const common = { action, operationId, expectedUpdatedAt: initialVersion };
  return action === "save"
    ? { ...common, payload: { ...seed, ...changes } }
    : { ...common, sections: changes, baseSections: financial ? {} : { materiais: seed.materiais } };
}

describe.skipIf(!url)("salvamento auditável com conexões PostgreSQL reais", () => {
  beforeAll(async () => {
    root = postgres(url, { max: 1, onnotice: () => {} });
    await root.unsafe(`create database "${database}"`);
    const target = new URL(url);
    target.pathname = `/${database}`;
    sql = postgres(target.toString(), { max: 8, onnotice: () => {} });
    state.sql = sql;
    await sql.unsafe(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
      end $$;
      create table public.company_app_data (
        company_id text, key text, value jsonb, updated_at timestamptz default now(), updated_by uuid,
        primary key(company_id,key));
      create function public.fail_test_receipt() returns trigger language plpgsql as $$
      begin
        if new.operation_id = 'rollback-op' then
          raise exception 'injected receipt failure';
        end if;
        return new;
      end $$;
    `);
    await loadMigration("20260725_append_only_audit");
    await loadMigration("024_legacy_save_receipts.up");
    state.db = camadaSupabase({ query: async (statement, args) => ({
      rows: await sql.unsafe(statement, args.map(value => typeof value === "string" && /^[\[{]/.test(value) ? JSON.parse(value) : value)),
    }) });
    vi.stubEnv("SUPABASE_URL", "https://pg.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("COMPANY_ID", "arcd");
    vi.stubEnv("FINANCIAL_ENGINE_ENFORCE", "false");
    vi.resetModules();
    ({ default: handler } = await import("../api/data.js"));
  }, 30000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    await sql?.end({ timeout: 5 });
    try {
      if (root) await root.unsafe(`drop database if exists "${database}"`);
    } finally {
      await root?.end({ timeout: 5 });
    }
  });

  beforeEach(async () => {
    await sql`truncate company_app_data, audit_events, legacy_save_receipts`;
    await sql`insert into company_app_data values ('arcd',${core},${sql.json(seed)},${initialVersion},null)`;
  });

  it.each([
    ["save", false], ["save-sections", false], ["save", true], ["save-sections", true],
  ])("%s com simultaneidade e resposta perdida (financeiro=%s)", async (action, financial) => {
    vi.stubEnv("POSTGRES_URL_NON_POOLING", action === "save-sections" ? url : undefined);
    const body = request(action, financial, "race");
    let unlock;
    const canCommit = new Promise(resolve => { unlock = resolve; });
    let lockAcquired;
    const locked = new Promise(resolve => { lockAcquired = resolve; });
    const barrier = sql.begin(async tx => {
      await tx`select * from public.lock_legacy_save_receipt('arcd','admin',${action},'race')`;
      lockAcquired();
      await canCommit;
    });
    await locked;
    const requests = Promise.all([send(body), send(body)]);
    try {
      await vi.waitFor(async () => {
        const [{ waiting }] = await sql`select count(*)::int as waiting from pg_stat_activity
          where datname=current_database() and wait_event='advisory'`;
        expect(waiting).toBe(2);
      }, { timeout: 7000 });
    } finally {
      unlock();
      await barrier;
      await requests;
    }

    const results = await requests;
    expect(results.map(r => r.status), JSON.stringify(results)).toEqual([200, 200]);
    expect(results.filter(r => r.body.replayed)).toHaveLength(1);
    const committed = await stored();
    const replay = await send(body);
    expect(replay).toMatchObject({ status: 200, body: { replayed: true, ok: true } });
    expect(await count()).toEqual({ events: 1, receipts: 1 });
    expect(await stored()).toEqual(committed);
    const [event] = await sql`select a.action, a.correlation_id=r.correlation_id as matched
      from audit_events a join legacy_save_receipts r on a.correlation_id=r.correlation_id`;
    expect(event).toEqual({
      action: `${financial ? "financial_shadow_" : ""}save_${action === "save" ? "blob" : "sections"}`,
      matched: true,
    });

    const contentField = action === "save" ? "payload" : "sections";
    const changed = { ...body, [contentField]: { ...body[contentField], materiais: [{ id: "m1", descricao: "Outro conteúdo" }] } };
    expect(await send(changed)).toMatchObject({ status: 409, body: { code: "SAVE_OPERATION_REUSED" } });
    expect(await count()).toEqual({ events: 1, receipts: 1 });
    expect(await stored()).toEqual(committed);
    if (financial) {
      const [{ payload }] = buildRequestedDreProjectionRows(committed.value, [
        { year: 2026, month: 10, period: "mes", scope: "company_dre" },
      ]);
      expect(committed.value.despesasEmpresa).toEqual([expense]);
      expect(payload.lucroLiquido).toBeCloseTo(-123.45);
    }
  }, 20000);

  it.each(["save", "save-sections"])("%s reverte dados e auditoria se o recibo falhar", async action => {
    vi.stubEnv("POSTGRES_URL_NON_POOLING", action === "save-sections" ? url : undefined);
    const body = request(action, false, "rollback-op");
    const before = await stored();
    await sql`create trigger fail_test_receipt before insert on legacy_save_receipts
      for each row execute function public.fail_test_receipt()`;
    try {
      expect((await send(body)).status).toBe(500);
      expect(await count()).toEqual({ events: 0, receipts: 0 });
      expect(await stored()).toEqual(before);
    } finally {
      await sql`drop trigger fail_test_receipt on legacy_save_receipts`;
    }
    expect((await send(body)).status).toBe(200);
    expect(await count()).toEqual({ events: 1, receipts: 1 });
  });

  it("clientes antigos continuam gravando e uma nova identidade não herda o recibo anterior", async () => {
    vi.stubEnv("POSTGRES_URL_NON_POOLING", url);
    const oldClient = request("save-sections", false, undefined);
    expect((await send(oldClient)).status).toBe(200);
    expect(await count()).toEqual({ events: 1, receipts: 0 });
    const first = { ...oldClient, operationId: "new-op-1", expectedUpdatedAt: (await stored()).version };
    expect(await send(first)).toMatchObject({ status: 200, body: { ok: true } });
    const newest = [{ id: "m1", descricao: "Cimento novo" }];
    expect(await send({
      ...first, operationId: "new-op-2", expectedUpdatedAt: (await stored()).version,
      sections: { materiais: newest }, baseSections: first.sections,
    })).toMatchObject({ status: 200, body: { ok: true } });
    expect(await send(first)).toMatchObject({
      status: 200, body: { replayed: true, data: { materiais: newest } },
    });
    expect(await count()).toEqual({ events: 3, receipts: 2 });
  });

  it("recompõe o custo de mão de obra da fonte arquivada ao devolver a confirmação", async () => {
    vi.stubEnv("POSTGRES_URL_NON_POOLING", url);
    const period = "2026-07-Q1";
    const archive = {
      attendance: { e1: { "2026-07-10": { status: "P", obraId: "obra-a" } } },
      employeesSnapshot: [{ id: "e1", obra: "obra-a", dailyRate: 100, vtDaily: 10, workdayHours: 8 }],
    };
    await sql`update company_app_data set value=value||${sql.json({
      config: { laborCharges: { diaristaPercent: 10 } },
      quinzenasArquivadas: { [period]: { inicio: "2026-07-01", fim: "2026-07-15" } },
    })} where key=${core}`;
    await sql`insert into company_app_data values ('arcd',${`${core}__arq__${period}`},${sql.json(archive)},${initialVersion},null)`;
    const body = request("save-sections", false, "archived");
    expect((await send(body)).status).toBe(200);
    const { body: replay, status } = await send(body);
    expect(status).toBe(200);
    expect(replay.replayed).toBe(true);
    expect(replay.data.archivedLaborCosts[period].byDate["2026-07-10"]["obra-a"]).toEqual({ laborCost: 110, benefitCost: 10 });
    expect(await count()).toEqual({ events: 1, receipts: 1 });
  });
});
