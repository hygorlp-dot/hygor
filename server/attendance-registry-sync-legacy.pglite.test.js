// @vitest-environment node
//
// Teste de execução real (não apenas asserções de texto) para a RPC
// `attendance_registry_sync_legacy` criada em
// migrations/015_create_attendance_registry_projection.up.sql. Mesmo
// padrão de server/equipment-registry-sync-legacy.pglite.test.js (ver esse
// arquivo para o racional completo de usar @electric-sql/pglite aqui).
//
// CORE-004 (02/09/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): a
// projeção de ponto é o oposto do desenho legado por propósito - UMA linha
// por (funcionário,data), sem partição por obra, para eliminar por
// construção a classe de bug corrigida no mesmo dia (registro "fantasma"
// numa obra antiga, dependente da ordem de leitura). core_attendance_
// records referencia tanto core_employees quanto core_projects (migration
// 007) - o teste aplica as duas migrações em sequência e semeia um
// funcionário/projeto mínimos antes de exercitar a RPC.

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
const ATTENDANCE_REGISTRY_MIGRATION_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "015_create_attendance_registry_projection.up.sql"),
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
  await db.exec(ATTENDANCE_REGISTRY_MIGRATION_SQL);

  // core_attendance_records exige funcionário e obra já sincronizados (FK
  // real) - semeia o mínimo direto, sem passar pela RPC de CORE-001 (fora
  // do escopo deste teste).
  await db.query(
    `insert into public.core_projects(company_id,id,name,source_hash) values ($1,$2,$3,$4)`,
    ["empresa-1", "obra-1", "Residencial Alfa", HASH_A],
  );
  await db.query(
    `insert into public.core_employees(company_id,id,name,source_hash) values ($1,$2,$3,$4)`,
    ["empresa-1", "func-1", "Alisson dos Santos Oliveira", HASH_B],
  );
}, 30000);

afterEach(async () => {
  await db.close();
}, 15000);

function buildSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    complete: true,
    records: [],
    ...overrides,
  };
}

async function syncLegacy(companyId, actorId, snapshot) {
  return db.query(
    "select attendance_registry_sync_legacy($1, $2, $3::jsonb) as result",
    [companyId, actorId, JSON.stringify(snapshot)],
  );
}

describe("attendance_registry_sync_legacy (execução real via pglite)", () => {
  it("grava um registro de ponto real com os valores corretos", async () => {
    const snapshot = buildSnapshot({
      records: [{
        id: "func-1__2026-08-21", employeeId: "func-1", date: "2026-08-21", projectId: "obra-1",
        status: "P", ot: 1.5, workedMinutes: 480, atrasoMin: 10, note: "Turno normal",
        sourceHash: HASH_A, payload: { status: "P", obraId: "obra-1" },
      }],
    });

    const { rows } = await syncLegacy("empresa-1", "ator-1", snapshot);
    expect(rows[0].result).toMatchObject({ records: 1 });

    const record = (
      await db.query(
        "select id, employee_id, project_id, to_char(record_date,'YYYY-MM-DD') as record_date, status, ot, worked_minutes, atraso_min, note, payload from core_attendance_records where company_id = $1 and id = $2",
        ["empresa-1", "func-1__2026-08-21"],
      )
    ).rows[0];
    expect(record).toMatchObject({
      id: "func-1__2026-08-21", employee_id: "func-1", project_id: "obra-1",
      record_date: "2026-08-21", status: "P", worked_minutes: 480, atraso_min: 10,
      note: "Turno normal", payload: { status: "P", obraId: "obra-1" },
    });
    expect(Number(record.ot)).toBe(1.5);

    const auditRow = (
      await db.query("select action, actor_id, source from public.audit_events where company_id = $1", ["empresa-1"])
    ).rows[0];
    expect(auditRow).toMatchObject({
      action: "attendance_registry_shadow_synced", actor_id: "ator-1", source: "migration/015",
    });
  });

  it("aceita project_id nulo (funcionário sem obra do dia)", async () => {
    await syncLegacy("empresa-1", "ator-1", buildSnapshot({
      records: [{
        id: "func-1__2026-08-21", employeeId: "func-1", date: "2026-08-21", projectId: "",
        status: "F", sourceHash: HASH_A,
      }],
    }));
    const record = (
      await db.query("select project_id, status from core_attendance_records where company_id = $1 and id = $2", ["empresa-1", "func-1__2026-08-21"])
    ).rows[0];
    expect(record).toMatchObject({ project_id: null, status: "F" });
  });

  it("arquiva (não apaga) registros ausentes numa nova sincronização - dia limpo pelo usuário", async () => {
    const firstSnapshot = buildSnapshot({
      records: [
        { id: "func-1__2026-08-21", employeeId: "func-1", date: "2026-08-21", projectId: "obra-1", status: "P", sourceHash: HASH_A },
        { id: "func-1__2026-08-22", employeeId: "func-1", date: "2026-08-22", projectId: "obra-1", status: "P", sourceHash: HASH_B },
      ],
    });
    await syncLegacy("empresa-1", "ator-1", firstSnapshot);

    const afterFirst = (
      await db.query("select id, archived_at from core_attendance_records where company_id = $1 order by id", ["empresa-1"])
    ).rows;
    expect(afterFirst).toHaveLength(2);
    expect(afterFirst.every(row => row.archived_at === null)).toBe(true);

    const secondSnapshot = buildSnapshot({
      records: [{ id: "func-1__2026-08-21", employeeId: "func-1", date: "2026-08-21", projectId: "obra-1", status: "P", sourceHash: HASH_A }],
    });
    await syncLegacy("empresa-1", "ator-1", secondSnapshot);

    const afterSecond = (
      await db.query("select id, archived_at is not null as is_archived from core_attendance_records where company_id = $1 order by id", ["empresa-1"])
    ).rows;
    expect(afterSecond).toHaveLength(2);
    const day21 = afterSecond.find(row => row.id === "func-1__2026-08-21");
    const day22 = afterSecond.find(row => row.id === "func-1__2026-08-22");
    expect(day21).toMatchObject({ is_archived: false });
    expect(day22).toMatchObject({ is_archived: true });
  });

  it("recupera (desarquiva) um dia que volta a aparecer no snapshot - relançado depois de limpo", async () => {
    const record = { id: "func-1__2026-08-21", employeeId: "func-1", date: "2026-08-21", projectId: "obra-1", status: "P", sourceHash: HASH_A };

    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ records: [record] }));
    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ records: [] }));
    let row = (
      await db.query("select archived_at is not null as is_archived from core_attendance_records where company_id = $1 and id = $2", ["empresa-1", "func-1__2026-08-21"])
    ).rows[0];
    expect(row).toMatchObject({ is_archived: true });

    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ records: [record] }));
    row = (
      await db.query("select archived_at is not null as is_archived from core_attendance_records where company_id = $1 and id = $2", ["empresa-1", "func-1__2026-08-21"])
    ).rows[0];
    expect(row).toMatchObject({ is_archived: false });
  });

  it("rejeita registro referenciando funcionário inexistente (violação de FK real)", async () => {
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({
      records: [{ id: "fantasma__2026-08-21", employeeId: "funcionario-fantasma", date: "2026-08-21", projectId: "obra-1", status: "P", sourceHash: HASH_A }],
    }))).rejects.toThrow();
  });

  it("rejeita registro referenciando obra inexistente (violação de FK real)", async () => {
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({
      records: [{ id: "func-1__2026-08-21", employeeId: "func-1", date: "2026-08-21", projectId: "obra-fantasma", status: "P", sourceHash: HASH_A }],
    }))).rejects.toThrow();
  });

  it("rejeita status fora do domínio permitido (violação de check real)", async () => {
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({
      records: [{ id: "func-1__2026-08-21", employeeId: "func-1", date: "2026-08-21", projectId: "obra-1", status: "X", sourceHash: HASH_A }],
    }))).rejects.toThrow();
  });

  it("rejeita company_id ou actor_id vazios com a exceção esperada", async () => {
    const snapshot = buildSnapshot();
    await expect(syncLegacy("", "ator-1", snapshot)).rejects.toThrow(/attendance_registry_invalid_actor_or_company/);
    await expect(syncLegacy("empresa-1", "  ", snapshot)).rejects.toThrow(/attendance_registry_invalid_actor_or_company/);
  });

  it("rejeita snapshot incompleto ou com schemaVersion incorreta", async () => {
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({ complete: false }))).rejects.toThrow(/attendance_registry_invalid_snapshot/);
    await expect(syncLegacy("empresa-1", "ator-1", buildSnapshot({ schemaVersion: 2 }))).rejects.toThrow(/attendance_registry_invalid_snapshot/);
  });
});
