// @ts-check
import { currentCompany } from "./company-context.js";

/** @typedef {Pick<import("@supabase/supabase-js").SupabaseClient, "from" | "rpc">} PersistenceDb */
/** @typedef {{role?: string, id?: string, nome?: string}} Actor */
/**
 * @typedef {{status: 403, body: {error: string}}
 *   | {status: 503, body: {ok: false, code: string, error: string}}
 *   | {status: 200, body: {ok: true, companyAppData: true, auditRpc: true, attendanceArchiveRpc: true}}} HealthResult
 */

/** @param {{db: PersistenceDb, key: string, randomUUID: () => string}} options */
export function createPersistenceHealthCheck({ db, key, randomUUID }) {
  /** @param {Actor} user @returns {Promise<HealthResult>} */
  return async user => {
    if (user.role !== "admin") {
      return { status: 403, body: { error: "Apenas administradores verificam a persistência." } };
    }
    const tableCheck = await db.from("company_app_data").select("key", { head: true, count: "exact" })
      .eq("company_id", currentCompany()).eq("key", key);
    if (tableCheck.error) return { status: 503, body: {
      ok: false, code: "COMPANY_APP_DATA_UNAVAILABLE",
      error: "A tabela principal não respondeu à verificação.",
    } };

    const probe = {
      p_company_id: `${currentCompany()}__health_probe`,
      p_expected_updated_at: "1970-01-01T00:00:00.000Z",
      p_actor_id: String(user.id || "admin"),
      p_actor_name: String(user.nome || "Administrador"),
      p_before: {},
      p_after: {},
    };
    const auditCheck = await db.rpc("company_save_with_audit", {
      ...probe, p_key: "health", p_value: {}, p_correlation_id: randomUUID(), p_action: "health_probe",
    });
    if (auditCheck.error) return { status: 503, body: {
      ok: false, code: "AUDIT_RPC_UNAVAILABLE",
      error: "A RPC append-only não está disponível. Execute migrations/20260725_append_only_audit.sql.",
    } };
    const archiveCheck = await db.rpc("attendance_archive_transaction", {
      ...probe, p_main_key: "health", p_archive_key: "health_archive", p_main_value: {},
      p_actor_role: String(user.role || ""), p_correlation_id: randomUUID(),
    });
    if (archiveCheck.error) return { status: 503, body: {
      ok: false, code: "ATTENDANCE_ARCHIVE_RPC_UNAVAILABLE",
      error: "A RPC transacional do arquivo de ponto não está disponível. Execute migrations/006_attendance_archive_transaction.up.sql.",
    } };
    return { status: 200, body: { ok: true, companyAppData: true, auditRpc: true, attendanceArchiveRpc: true } };
  };
}
