// @vitest-environment node
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { expect, it } from "vitest";
import { camadaSupabase } from "./ponto-eletronico/banco-pglite.test-helper.js";

const sqlFile = name => readFile(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8");

it("migra, deduplica a RPC e desfaz a estrutura sem apagar a trilha", async () => {
  const pg = await PGlite.create({ extensions: { pgcrypto } });
  try {
    await pg.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table public.company_app_data (
        company_id text, key text, value jsonb, updated_at timestamptz, updated_by text, primary key(company_id,key));
      insert into public.company_app_data values ('arcd','core','{}','2026-11-01',null);
    `);
    await pg.exec(await sqlFile("20260725_append_only_audit"));
    const migration = await sqlFile("024_legacy_save_receipts.up");
    await pg.exec(migration);
    await pg.exec(migration);
    const db = camadaSupabase(pg);
    const params = {
      p_company_id: "arcd", p_key: "core", p_expected_updated_at: "2026-11-01", p_value: { name: "alterado" },
      p_actor_id: "admin", p_actor_name: "Admin", p_correlation_id: randomUUID(), p_action: "save_blob",
      p_before: {}, p_after: { name: "alterado" }, p_operation: "save", p_operation_id: "req-1", p_request_hash: "sha-1",
    };
    const send = (patch = {}) => db.rpc("save_legacy_operation_with_audit", { ...params, ...patch });

    const first = await send();
    expect(first.error).toBeNull();
    expect(first.data[0]).toMatchObject({ applied: true, replayed: false });
    const duplicate = await send({ p_correlation_id: randomUUID() });
    expect(duplicate.data[0]).toMatchObject({ applied: true, replayed: true, correlation_id: params.p_correlation_id });
    expect((await send({ p_request_hash: "outra" })).error).toMatchObject({ code: "P0409" });

    // Mesma chave textual em outro escopo chega ao CAS original, sem herdar
    // o recibo de uma operação de outra ação, empresa ou autor.
    for (const patch of [{ p_operation: "save-sections" }, { p_actor_id: "outro" }, { p_company_id: "outra" }]) {
      expect((await send(patch)).data[0]).toMatchObject({ applied: false, replayed: false });
    }
    const access = await pg.query(`
      select has_table_privilege('authenticated','public.legacy_save_receipts','select') as exposed,
        has_table_privilege('service_role','public.legacy_save_receipts','select') as server,
        exists (
          select 1 from pg_proc
          where proname in ('lock_legacy_save_receipt','save_legacy_operation_with_audit')
            and (has_function_privilege('anon',oid,'execute') or has_function_privilege('authenticated',oid,'execute'))
        ) as function_exposed
    `);
    expect(access.rows[0]).toEqual({ exposed: false, server: true, function_exposed: false });
    expect((await pg.query("select correlation_id from audit_events")).rows).toEqual([{ correlation_id: params.p_correlation_id }]);

    await pg.exec(await sqlFile("024_legacy_save_receipts.down"));
    expect((await pg.query("select to_regclass('public.legacy_save_receipts') as receipts")).rows[0].receipts).toBeNull();
    expect((await pg.query("select correlation_id from audit_events")).rows).toEqual([{ correlation_id: params.p_correlation_id }]);
    expect((await pg.query("select value from company_app_data")).rows).toEqual([{ value: { name: "alterado" } }]);
  } finally {
    await pg.close();
  }
}, 20000);
