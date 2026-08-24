import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const up=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/010_create_purchase_requests_live.up.sql"),
  "utf8",
);
const down=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/010_create_purchase_requests_live.down.sql"),
  "utf8",
);

describe("010 purchase_requests live migration", () => {
  it("cria a tabela idempotentemente e oferece rollback completo", () => {
    expect(up).toContain("create table if not exists public.purchase_requests");
    expect(down).toContain("drop table if exists public.purchase_requests");
  });

  it("protege a tabela com RLS e sem acesso direto do navegador", () => {
    expect(up).toContain("alter table public.purchase_requests enable row level security");
    expect(up).toContain("revoke all on table public.purchase_requests from public, anon, authenticated");
    expect(up).toContain("grant select, insert, update on table public.purchase_requests to service_role");
  });

  it("referencia core_projects (migration 007) por chave estrangeira, não recria a tabela", () => {
    expect(up).toContain("references public.core_projects(company_id, id)");
    expect(up).not.toContain("create table if not exists public.core_projects");
  });

  it("não apaga nem altera o blob legado", () => {
    expect(up).not.toMatch(/delete\s+from\s+public\.company_app_data/i);
    expect(up).not.toMatch(/update\s+public\.company_app_data/i);
  });

  it("possui índice para o filtro principal de empresa e obra", () => {
    expect(up).toContain("index if not exists idx_purchase_requests_company_project");
  });
});
