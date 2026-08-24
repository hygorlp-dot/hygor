// @vitest-environment node
//
// Teste de execução real (não apenas asserções de texto) para a RPC
// `procurement_registry_sync_legacy` criada em
// migrations/014_create_procurement_projection.up.sql. Mesmo padrão de
// server/core-registry-sync-legacy.pglite.test.js (ver esse arquivo para o
// racional completo de usar @electric-sql/pglite aqui).
//
// Diferente do CORE-001, esta migração tem chave estrangeira real para
// core_projects e core_suppliers (migration 007) - o teste aplica as duas
// migrações em sequência e semeia um projeto/fornecedor mínimos antes de
// exercitar a RPC, para poder provar tanto o caminho feliz quanto a
// rejeição por violação de integridade referencial.

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

vi.setConfig({ testTimeout: 20000 });

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

const AUDIT_EVENTS_MIGRATION_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "20260725_append_only_audit.sql"),
  "utf8",
);
const CORE_REGISTRY_MIGRATION_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "007_create_core_registry_projection.up.sql"),
  "utf8",
);
const PROCUREMENT_REGISTRY_MIGRATION_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "014_create_procurement_projection.up.sql"),
  "utf8",
);

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

let db;

beforeEach(async () => {
  db = new PGlite({ extensions: { pgcrypto } });

  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
    end $$;
  `);

  await db.exec(`
    create table if not exists public.company_app_data (
      company_id text not null,
      key text not null,
      value jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      updated_by text,
      primary key (company_id, key)
    );
  `);

  await db.exec(AUDIT_EVENTS_MIGRATION_SQL);
  await db.exec(CORE_REGISTRY_MIGRATION_SQL);
  await db.exec(PROCUREMENT_REGISTRY_MIGRATION_SQL);

  // core_quotations/core_purchase_orders exigem um projeto e um fornecedor
  // já sincronizados (FK real) - semeia o mínimo direto, sem passar pela
  // RPC de CORE-001 (fora do escopo deste teste).
  await db.query(
    `insert into public.core_projects(company_id,id,name,source_hash) values ($1,$2,$3,$4)`,
    ["empresa-1", "obra-1", "Residencial Alfa", HASH_A],
  );
  await db.query(
    `insert into public.core_suppliers(company_id,id,name,source_hash) values ($1,$2,$3,$4)`,
    ["empresa-1", "f-1", "Fornecedor Um", HASH_A],
  );
}, 30000);

afterEach(async () => {
  await db.close();
}, 15000);

function buildSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    complete: true,
    quotations: [],
    purchaseOrders: [],
    ...overrides,
  };
}

async function syncLegacy(companyId, actorId, snapshot) {
  return db.query(
    "select procurement_registry_sync_legacy($1, $2, $3::jsonb) as result",
    [companyId, actorId, JSON.stringify(snapshot)],
  );
}

describe("procurement_registry_sync_legacy (execução real via pglite)", () => {
  it("grava cotações e pedidos reais com os valores corretos", async () => {
    const snapshot = buildSnapshot({
      quotations: [
        {
          id: "c-1", projectId: "obra-1", materialId: "m-1", requestId: "s-1",
          status: "aberta", active: true, quantity: 5, sourceVersion: 1,
          sourceHash: HASH_A, payload: { foo: "bar" },
        },
      ],
      purchaseOrders: [
        {
          id: "p-1", projectId: "obra-1", supplierId: "f-1", quoteId: "c-1", requestId: "s-1",
          numero: "PC-0001", status: "enviado", active: true, sourceVersion: 2,
          sourceHash: HASH_B, payload: { baz: "qux" },
        },
      ],
    });

    const { rows } = await syncLegacy("empresa-1", "ator-1", snapshot);
    expect(rows[0].result).toMatchObject({ quotations: 1, purchaseOrders: 1 });

    const quotation = (
      await db.query(
        "select id, project_id, material_id, request_id, status, active, quantity, source_version, payload from core_quotations where company_id = $1 and id = $2",
        ["empresa-1", "c-1"],
      )
    ).rows[0];
    expect(quotation).toMatchObject({
      id: "c-1", project_id: "obra-1", material_id: "m-1", request_id: "s-1",
      status: "aberta", active: true, quantity: "5", source_version: 1, payload: { foo: "bar" },
    });

    const order = (
      await db.query(
        "select id, project_id, supplier_id, quote_id, request_id, numero, status, active from core_purchase_orders where company_id = $1 and id = $2",
        ["empresa-1", "p-1"],
      )
    ).rows[0];
    expect(order).toMatchObject({
      id: "p-1", project_id: "obra-1", supplier_id: "f-1", quote_id: "c-1",
      request_id: "s-1", numero: "PC-0001", status: "enviado", active: true,
    });

    const auditRow = (
      await db.query(
        "select action, actor_id, source from public.audit_events where company_id = $1",
        ["empresa-1"],
      )
    ).rows[0];
    expect(auditRow).toMatchObject({
      action: "procurement_registry_shadow_synced",
      actor_id: "ator-1",
      source: "migration/014",
    });
  });

  it("arquiva (não apaga) registros ausentes numa nova sincronização", async () => {
    const firstSnapshot = buildSnapshot({
      quotations: [
        { id: "c-1", projectId: "obra-1", materialId: "m-1", sourceHash: HASH_A },
        { id: "c-2", projectId: "obra-1", materialId: "m-2", sourceHash: HASH_B },
      ],
    });
    await syncLegacy("empresa-1", "ator-1", firstSnapshot);

    const afterFirst = (
      await db.query(
        "select id, active, archived_at from core_quotations where company_id = $1 order by id",
        ["empresa-1"],
      )
    ).rows;
    expect(afterFirst).toHaveLength(2);
    expect(afterFirst.every(row => row.active && row.archived_at === null)).toBe(true);

    const secondSnapshot = buildSnapshot({
      quotations: [{ id: "c-1", projectId: "obra-1", materialId: "m-1", sourceHash: HASH_A }],
    });
    await syncLegacy("empresa-1", "ator-1", secondSnapshot);

    const afterSecond = (
      await db.query(
        "select id, active, archived_at is not null as is_archived from core_quotations where company_id = $1 order by id",
        ["empresa-1"],
      )
    ).rows;
    expect(afterSecond).toHaveLength(2);

    const c1 = afterSecond.find(row => row.id === "c-1");
    const c2 = afterSecond.find(row => row.id === "c-2");
    expect(c1).toMatchObject({ active: true, is_archived: false });
    expect(c2).toMatchObject({ active: false, is_archived: true });
  });

  it("recupera (desarquiva) um pedido que volta a aparecer no snapshot", async () => {
    const order = { id: "p-1", projectId: "obra-1", supplierId: "f-1", sourceHash: HASH_A };
    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ purchaseOrders: [order] }));
    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ purchaseOrders: [] }));
    let row = (
      await db.query(
        "select active, archived_at is not null as is_archived from core_purchase_orders where company_id = $1 and id = $2",
        ["empresa-1", "p-1"],
      )
    ).rows[0];
    expect(row).toMatchObject({ active: false, is_archived: true });

    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ purchaseOrders: [order] }));
    row = (
      await db.query(
        "select active, archived_at is not null as is_archived from core_purchase_orders where company_id = $1 and id = $2",
        ["empresa-1", "p-1"],
      )
    ).rows[0];
    expect(row).toMatchObject({ active: true, is_archived: false });
  });

  it("rejeita pedido referenciando fornecedor inexistente (violação de FK real)", async () => {
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({
      purchaseOrders: [{ id: "p-1", projectId: "obra-1", supplierId: "fornecedor-fantasma", sourceHash: HASH_A }],
    }))).rejects.toThrow();
  });

  it("rejeita company_id ou actor_id vazios com a exceção esperada", async () => {
    const snapshot = buildSnapshot();

    await expect(syncLegacy("", "ator-1", snapshot)).rejects.toThrow(
      /procurement_registry_invalid_actor_or_company/,
    );
    await expect(syncLegacy("empresa-1", "  ", snapshot)).rejects.toThrow(
      /procurement_registry_invalid_actor_or_company/,
    );
  });

  it("rejeita snapshot incompleto ou com schemaVersion incorreta", async () => {
    await expect(
      syncLegacy("empresa-1", "ator-1", buildSnapshot({ complete: false })),
    ).rejects.toThrow(/procurement_registry_invalid_snapshot/);

    await expect(
      syncLegacy("empresa-1", "ator-1", buildSnapshot({ schemaVersion: 2 })),
    ).rejects.toThrow(/procurement_registry_invalid_snapshot/);
  });
});
