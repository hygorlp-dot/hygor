import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const up=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/013_revoke_purchase_requests_delete.up.sql"),
  "utf8",
);
const down=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/013_revoke_purchase_requests_delete.down.sql"),
  "utf8",
);

describe("013 revoke purchase_requests delete migration", () => {
  it("revoga delete de service_role e oferece rollback (reconceder)", () => {
    expect(up).toContain("revoke delete on table public.purchase_requests from service_role");
    expect(down).toContain("grant delete on table public.purchase_requests to service_role");
  });

  it("não recria a tabela nem toca em outros grants", () => {
    expect(up).not.toContain("create table");
    expect(up).not.toContain("select");
    expect(up).not.toContain("insert");
  });
});
