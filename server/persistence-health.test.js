import { describe, expect, it, vi } from "vitest";
import { runWithCompany } from "./company-context.js";
import { createPersistenceHealthCheck } from "./persistence-health.js";

function fixture(tableError = null, rpcErrors = []) {
  const eq = vi.fn().mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: tableError }) });
  const select = vi.fn(() => ({ eq }));
  const db = {
    from: vi.fn(() => ({ select })),
    rpc: vi.fn(async () => ({ error: rpcErrors.shift() || null })),
  };
  const randomUUID = vi.fn().mockReturnValueOnce("audit-id").mockReturnValueOnce("archive-id");
  const check = createPersistenceHealthCheck({ db, key: "company-core", randomUUID });
  return { check, db, select, eq };
}

describe("verificação de persistência", () => {
  it("recusa outro perfil antes de consultar o banco", async () => {
    const { check, db } = fixture();
    await expect(check({ role: "financeiro" })).resolves.toEqual({
      status: 403, body: { error: "Apenas administradores verificam a persistência." },
    });
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("consulta a empresa da sessão e chama só as verificações previstas", async () => {
    const { check, db, select, eq } = fixture();
    await expect(runWithCompany("mrc", () => check({ role: "admin", id: "u-1", nome: "Admin de teste" })))
      .resolves.toEqual({ status: 200, body: { ok: true, companyAppData: true, auditRpc: true, attendanceArchiveRpc: true } });
    expect(db.from).toHaveBeenCalledWith("company_app_data");
    expect(select).toHaveBeenCalledWith("key", { head: true, count: "exact" });
    expect(eq).toHaveBeenCalledWith("company_id", "mrc");
    expect(eq.mock.results[0].value.eq).toHaveBeenCalledWith("key", "company-core");
    expect(db.rpc.mock.calls).toEqual([
      ["company_save_with_audit", {
        p_company_id: "mrc__health_probe", p_key: "health",
        p_expected_updated_at: "1970-01-01T00:00:00.000Z", p_value: {},
        p_actor_id: "u-1", p_actor_name: "Admin de teste", p_correlation_id: "audit-id",
        p_action: "health_probe", p_before: {}, p_after: {},
      }],
      ["attendance_archive_transaction", {
        p_company_id: "mrc__health_probe", p_main_key: "health", p_archive_key: "health_archive",
        p_expected_updated_at: "1970-01-01T00:00:00.000Z", p_main_value: {},
        p_actor_id: "u-1", p_actor_name: "Admin de teste", p_actor_role: "admin",
        p_correlation_id: "archive-id", p_before: {}, p_after: {},
      }],
    ]);
  });

  it.each([
    [new Error("tabela"), [], "COMPANY_APP_DATA_UNAVAILABLE", 0],
    [null, [new Error("auditoria")], "AUDIT_RPC_UNAVAILABLE", 1],
    [null, [null, new Error("arquivo")], "ATTENDANCE_ARCHIVE_RPC_UNAVAILABLE", 2],
  ])("interrompe na primeira falha de persistência (%#)", async (tableError, rpcErrors, code, calls) => {
    const { check, db } = fixture(tableError, rpcErrors);
    await expect(check({ role: "admin" })).resolves.toMatchObject({ status: 503, body: { ok: false, code } });
    expect(db.rpc).toHaveBeenCalledTimes(calls);
  });
});
