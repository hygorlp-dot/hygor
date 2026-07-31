import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const up=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/007_create_core_registry_projection.up.sql"),
  "utf8",
);
const down=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/007_create_core_registry_projection.down.sql"),
  "utf8",
);

const tables=[
  "core_projects",
  "core_employees",
  "core_employee_assignments",
  "core_employee_identifiers",
  "core_suppliers",
  "core_third_party_profiles",
  "core_third_party_contracts",
  "core_registry_shadow_runs",
];

describe("007 core registry projection migration", () => {
  it("cria todas as tabelas idempotentemente e oferece rollback completo", () => {
    tables.forEach(table => {
      expect(up).toContain(`create table if not exists public.${table}`);
      expect(down).toContain(`drop table if exists public.${table}`);
    });
  });

  it("protege cada tabela com RLS e sem acesso direto do navegador", () => {
    tables.forEach(table => {
      expect(up).toContain(`alter table public.${table} enable row level security`);
      expect(up).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    });
  });

  it("mantém o blob intacto e arquiva ausências em vez de apagar fatos", () => {
    expect(up).not.toMatch(/delete\s+from\s+public\.core_/i);
    expect(up).not.toMatch(/update\s+public\.company_app_data/i);
    expect(up).not.toMatch(/delete\s+from\s+public\.company_app_data/i);
    expect(up).toContain("archived_at=v_now");
  });

  it("restringe a RPC de sincronização à service role", () => {
    expect(up).toContain("create or replace function public.core_registry_sync_legacy");
    expect(up).toContain(
      "revoke all on function public.core_registry_sync_legacy(text,text,jsonb)",
    );
    expect(up).toContain(
      "grant execute on function public.core_registry_sync_legacy(text,text,jsonb)",
    );
    expect(down).toContain(
      "drop function if exists public.core_registry_sync_legacy(text,text,jsonb)",
    );
  });

  it("possui índices para os filtros principais de empresa, obra e identificador", () => {
    [
      "idx_core_projects_company_status",
      "idx_core_employees_company_active",
      "idx_core_employee_assignments_project_active",
      "idx_core_employee_identifiers_lookup",
      "idx_core_suppliers_company_active",
      "idx_core_third_party_contracts_project_status",
    ].forEach(index => expect(up).toContain(`index if not exists ${index}`));
  });
});
