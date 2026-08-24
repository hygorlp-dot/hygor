import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const up=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/011_grant_purchase_requests_delete.up.sql"),
  "utf8",
);
const down=fs.readFileSync(
  path.resolve(process.cwd(), "migrations/011_grant_purchase_requests_delete.down.sql"),
  "utf8",
);

describe("011 grant purchase_requests delete migration", () => {
  it("concede delete só ao service_role e oferece rollback", () => {
    expect(up).toContain("grant delete on table public.purchase_requests to service_role");
    expect(down).toContain("revoke delete on table public.purchase_requests from service_role");
  });

  it("não recria a tabela", () => {
    expect(up).not.toContain("create table");
  });
});
