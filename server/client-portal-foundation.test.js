import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "migrations/005_client_portal_foundation.up.sql"), "utf8");
const api = readFileSync(resolve(process.cwd(), "api/data.js"), "utf8");

describe("fundação persistente do Portal do Cliente", () => {
  it("isola usuários, vínculos, sessões, auditoria e publicações em tabelas próprias", () => {
    ["client_portal_users", "client_portal_project_memberships", "client_portal_sessions", "client_portal_audit_events", "client_portal_publications"].forEach(table => expect(migration).toContain(`public.${table}`));
    expect(migration).not.toContain("company_app_data");
  });

  it("não abre tabelas do portal para anon/authenticated", () => {
    expect((migration.match(/enable row level security/g) || []).length).toBe(5);
    expect(migration).not.toMatch(/create policy/i);
  });

  it("restringe estados editoriais e perfis de relacionamento", () => {
    expect(migration).toContain("'published'");
    expect(migration).toContain("'owner'");
    expect(migration).toContain("'observer'");
  });

  it("provisiona e revoga acessos somente pelo comando administrativo autenticado", () => {
    expect(api).toContain('action === "client-portal-admin"');
    expect(api).toContain('usuario.role!=="admin"');
    expect(api).toContain("hashPortalPassword(password)");
    expect(api).toContain('operation==="revoke"');
    expect(api).toContain('event_type:"access_provisioned"');
    expect(api).toContain('event_type:"access_revoked"');
  });
});
