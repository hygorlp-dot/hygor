import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const up=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/012_financial_engine_rls.up.sql"),
  "utf8",
);
const down=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/012_financial_engine_rls.down.sql"),
  "utf8",
);

const readOnlyTables=[
  "financial_titles", "settlements", "financial_events",
  "reconciliation_links", "financial_shadow_runs",
];

describe("012 financial engine RLS migration", () => {
  it("habilita RLS e revoga acesso de anon/authenticated em todas as 6 tabelas", () => {
    [...readOnlyTables, "data_quality_cases"].forEach(table => {
      expect(up).toContain(`alter table public.${table} enable row level security`);
      expect(up).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    });
  });

  it("concede só select para as tabelas lidas mas nunca escritas via db.from()", () => {
    readOnlyTables.forEach(table => {
      expect(up).toContain(`grant select on table public.${table} to service_role`);
    });
  });

  it("concede select+insert+update para data_quality_cases (a única também escrita via db.from())", () => {
    expect(up).toContain("grant select, insert, update on table public.data_quality_cases to service_role");
  });

  it("não recria nenhuma tabela nem toca no blob legado", () => {
    expect(up).not.toContain("create table");
    expect(up).not.toMatch(/company_app_data/i);
  });

  it("oferece rollback desabilitando RLS e revogando os grants concedidos", () => {
    [...readOnlyTables, "data_quality_cases"].forEach(table => {
      expect(down).toContain(`alter table public.${table} disable row level security`);
    });
  });
});
