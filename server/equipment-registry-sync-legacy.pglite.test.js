// @vitest-environment node
//
// Teste de execução real (não apenas asserções de texto) para a RPC
// `equipment_registry_sync_legacy` criada em
// migrations/009_create_equipment_registry_projection.up.sql. Mesmo padrão
// de server/core-registry-sync-legacy.pglite.test.js e
// server/procurement-registry-sync-legacy.pglite.test.js (ver o primeiro
// para o racional completo de usar @electric-sql/pglite aqui).
//
// Fechado em 01/09/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md) - era a
// única lacuna que faltava na infra de teste real: CORE-001 e CORE-003 já
// tinham este tipo de teste, CORE-002 continuava só com
// equipment-registry-migration.test.js (asserção estática de texto do
// SQL).
//
// Diferente do CORE-001, esta migração tem chave estrangeira real:
// core_equipment_allocations/core_equipment_maintenance_events referenciam
// tanto core_equipment (a própria migration 009) quanto core_projects
// (migration 007) - o teste aplica as duas migrações em sequência e semeia
// um projeto/equipamento mínimos antes de exercitar a RPC, para poder
// provar tanto o caminho feliz quanto a rejeição por violação de
// integridade referencial.

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
const EQUIPMENT_REGISTRY_MIGRATION_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "009_create_equipment_registry_projection.up.sql"),
  "utf8",
);

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

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
  await db.exec(EQUIPMENT_REGISTRY_MIGRATION_SQL);

  // core_equipment_allocations/core_equipment_maintenance_events exigem um
  // projeto já sincronizado (FK real) - semeia o mínimo direto, sem passar
  // pela RPC de CORE-001 (fora do escopo deste teste).
  await db.query(
    `insert into public.core_projects(company_id,id,name,source_hash) values ($1,$2,$3,$4)`,
    ["empresa-1", "obra-1", "Residencial Alfa", HASH_A],
  );
}, 30000);

afterEach(async () => {
  await db.close();
}, 15000);

function buildSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    complete: true,
    equipment: [],
    owners: [],
    allocations: [],
    maintenanceEvents: [],
    ...overrides,
  };
}

async function syncLegacy(companyId, actorId, snapshot) {
  return db.query(
    "select equipment_registry_sync_legacy($1, $2, $3::jsonb) as result",
    [companyId, actorId, JSON.stringify(snapshot)],
  );
}

describe("equipment_registry_sync_legacy (execução real via pglite)", () => {
  it("grava equipamento, proprietário, locação e manutenção reais com os valores corretos", async () => {
    const snapshot = buildSnapshot({
      equipment: [{
        id: "eq-1", name: "Betoneira 400L", category: "Concretagem", assetTag: "PAT-001",
        status: "disponivel", active: true, ownerId: "own-1", currentProjectId: "obra-1",
        acquisitionValue: 4500, sourceVersion: 3, sourceHash: HASH_A, payload: { nome: "Betoneira 400L" },
      }],
      owners: [{
        id: "own-1", name: "ARCD Construtech", ownerType: "empresa", active: true,
        sourceHash: HASH_B, payload: { nome: "ARCD Construtech" },
      }],
      allocations: [{
        id: "alloc-1", equipmentId: "eq-1", projectId: "obra-1",
        startDate: "2026-08-01", endDate: "2026-08-30", status: "ativa", active: true,
        sourceVersion: 1, sourceHash: HASH_C, payload: { obraId: "obra-1" },
      }],
      maintenanceEvents: [{
        id: "manut-1", equipmentId: "eq-1", projectId: "obra-1",
        startDate: "2026-08-05", endDate: "2026-08-06", cost: 350, description: "Troca de correia",
        status: "concluida", sourceHash: HASH_A, payload: { descricao: "Troca de correia" },
      }],
    });

    const { rows } = await syncLegacy("empresa-1", "ator-1", snapshot);
    expect(rows[0].result).toMatchObject({ equipment: 1, owners: 1, allocations: 1, maintenanceEvents: 1 });

    const equipment = (
      await db.query(
        "select id, name, category, asset_tag, status, active, owner_id, current_project_id, acquisition_value, source_version, payload from core_equipment where company_id = $1 and id = $2",
        ["empresa-1", "eq-1"],
      )
    ).rows[0];
    expect(equipment).toMatchObject({
      id: "eq-1", name: "Betoneira 400L", category: "Concretagem", asset_tag: "PAT-001",
      status: "disponivel", active: true, owner_id: "own-1", current_project_id: "obra-1",
      source_version: 3, payload: { nome: "Betoneira 400L" },
    });
    expect(Number(equipment.acquisition_value)).toBe(4500);

    const owner = (
      await db.query("select id, name, owner_type, active from core_equipment_owners where company_id = $1 and id = $2", ["empresa-1", "own-1"])
    ).rows[0];
    expect(owner).toMatchObject({ id: "own-1", name: "ARCD Construtech", owner_type: "empresa", active: true });

    const allocation = (
      await db.query(
        "select id, equipment_id, project_id, to_char(start_date,'YYYY-MM-DD') as start_date, to_char(end_date,'YYYY-MM-DD') as end_date, status, active from core_equipment_allocations where company_id = $1 and id = $2",
        ["empresa-1", "alloc-1"],
      )
    ).rows[0];
    expect(allocation).toMatchObject({
      id: "alloc-1", equipment_id: "eq-1", project_id: "obra-1",
      start_date: "2026-08-01", end_date: "2026-08-30", status: "ativa", active: true,
    });

    const maintenance = (
      await db.query("select id, equipment_id, project_id, cost, description, status from core_equipment_maintenance_events where company_id = $1 and id = $2", ["empresa-1", "manut-1"])
    ).rows[0];
    expect(maintenance).toMatchObject({
      id: "manut-1", equipment_id: "eq-1", project_id: "obra-1", description: "Troca de correia", status: "concluida",
    });
    expect(Number(maintenance.cost)).toBe(350);

    const auditRow = (
      await db.query("select action, actor_id, source from public.audit_events where company_id = $1", ["empresa-1"])
    ).rows[0];
    expect(auditRow).toMatchObject({
      action: "equipment_registry_shadow_synced", actor_id: "ator-1", source: "migration/009",
    });
  });

  it("arquiva (não apaga) registros ausentes numa nova sincronização", async () => {
    const firstSnapshot = buildSnapshot({
      equipment: [
        { id: "eq-1", name: "Betoneira", sourceHash: HASH_A },
        { id: "eq-2", name: "Andaime", sourceHash: HASH_B },
      ],
    });
    await syncLegacy("empresa-1", "ator-1", firstSnapshot);

    const afterFirst = (
      await db.query("select id, active, archived_at from core_equipment where company_id = $1 order by id", ["empresa-1"])
    ).rows;
    expect(afterFirst).toHaveLength(2);
    expect(afterFirst.every(row => row.active && row.archived_at === null)).toBe(true);

    const secondSnapshot = buildSnapshot({
      equipment: [{ id: "eq-1", name: "Betoneira", sourceHash: HASH_A }],
    });
    await syncLegacy("empresa-1", "ator-1", secondSnapshot);

    const afterSecond = (
      await db.query("select id, active, archived_at is not null as is_archived from core_equipment where company_id = $1 order by id", ["empresa-1"])
    ).rows;
    expect(afterSecond).toHaveLength(2);
    const eq1 = afterSecond.find(row => row.id === "eq-1");
    const eq2 = afterSecond.find(row => row.id === "eq-2");
    expect(eq1).toMatchObject({ active: true, is_archived: false });
    expect(eq2).toMatchObject({ active: false, is_archived: true });
  });

  it("recupera (desarquiva) uma locação que volta a aparecer no snapshot", async () => {
    const equipmentSnapshot = { id: "eq-1", name: "Betoneira", sourceHash: HASH_A };
    const allocation = { id: "alloc-1", equipmentId: "eq-1", projectId: "obra-1", startDate: "2026-08-01", sourceHash: HASH_B };

    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ equipment: [equipmentSnapshot], allocations: [allocation] }));
    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ equipment: [equipmentSnapshot], allocations: [] }));
    let row = (
      await db.query("select active, archived_at is not null as is_archived from core_equipment_allocations where company_id = $1 and id = $2", ["empresa-1", "alloc-1"])
    ).rows[0];
    expect(row).toMatchObject({ active: false, is_archived: true });

    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ equipment: [equipmentSnapshot], allocations: [allocation] }));
    row = (
      await db.query("select active, archived_at is not null as is_archived from core_equipment_allocations where company_id = $1 and id = $2", ["empresa-1", "alloc-1"])
    ).rows[0];
    expect(row).toMatchObject({ active: true, is_archived: false });
  });

  it("rejeita locação referenciando equipamento inexistente (violação de FK real)", async () => {
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({
      allocations: [{ id: "alloc-1", equipmentId: "equipamento-fantasma", projectId: "obra-1", startDate: "2026-08-01", sourceHash: HASH_A }],
    }))).rejects.toThrow();
  });

  it("rejeita manutenção referenciando obra inexistente (violação de FK real)", async () => {
    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ equipment: [{ id: "eq-1", name: "Betoneira", sourceHash: HASH_A }] }));
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({
      equipment: [{ id: "eq-1", name: "Betoneira", sourceHash: HASH_A }],
      maintenanceEvents: [{ id: "manut-1", equipmentId: "eq-1", projectId: "obra-fantasma", startDate: "2026-08-01", sourceHash: HASH_B }],
    }))).rejects.toThrow();
  });

  it("rejeita company_id ou actor_id vazios com a exceção esperada", async () => {
    const snapshot = buildSnapshot();
    await expect(syncLegacy("", "ator-1", snapshot)).rejects.toThrow(/equipment_registry_invalid_actor_or_company/);
    await expect(syncLegacy("empresa-1", "  ", snapshot)).rejects.toThrow(/equipment_registry_invalid_actor_or_company/);
  });

  it("rejeita snapshot incompleto ou com schemaVersion incorreta", async () => {
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({ complete: false }))).rejects.toThrow(/equipment_registry_invalid_snapshot/);
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({ schemaVersion: 2 }))).rejects.toThrow(/equipment_registry_invalid_snapshot/);
  });
});
