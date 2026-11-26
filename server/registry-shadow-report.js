import { currentCompany } from "./company-context.js";
import {
  CORE_REGISTRY_TABLES, summarizeCoreRegistryShadowStatus,
} from "./core-registry-shadow-status.js";
import {
  EQUIPMENT_REGISTRY_TABLES, summarizeEquipmentRegistryShadowStatus,
} from "./equipment-registry-shadow-status.js";
import {
  PROCUREMENT_REGISTRY_TABLES, summarizeProcurementRegistryShadowStatus,
} from "./procurement-registry-shadow-status.js";
import {
  ATTENDANCE_REGISTRY_TABLES, summarizeAttendanceRegistryShadowStatus,
} from "./attendance-registry-shadow-status.js";

const reports = new Map([
  ["core-registry-report", {
    runsTable: "core_registry_shadow_runs",
    tables: CORE_REGISTRY_TABLES,
    summarize: summarizeCoreRegistryShadowStatus,
    forbidden: "Apenas administradores consultam a projeção cadastral.",
  }],
  ["equipment-registry-report", {
    runsTable: "equipment_registry_shadow_runs",
    tables: EQUIPMENT_REGISTRY_TABLES,
    summarize: summarizeEquipmentRegistryShadowStatus,
    forbidden: "Apenas administradores consultam a projeção de equipamentos.",
  }],
  ["procurement-registry-report", {
    runsTable: "procurement_registry_shadow_runs",
    tables: PROCUREMENT_REGISTRY_TABLES,
    summarize: summarizeProcurementRegistryShadowStatus,
    forbidden: "Apenas administradores consultam a projeção de compras.",
  }],
  ["attendance-registry-report", {
    runsTable: "attendance_registry_shadow_runs",
    tables: ATTENDANCE_REGISTRY_TABLES,
    summarize: summarizeAttendanceRegistryShadowStatus,
    forbidden: "Apenas administradores consultam a projeção de ponto.",
  }],
]);

export const isRegistryShadowReport = action => reports.has(action);

export async function handleRegistryShadowReport({ action, usuario, res, db, createCoreDb }) {
  const { runsTable, tables, summarize, forbidden } = reports.get(action);
  if (usuario.role !== "admin") return res.status(403).json({ error: forbidden });

  // O relatório cadastral usa um cliente de serviço isolado por chamada.
  // Os demais usam o cliente compartilhado, separado do cliente de autenticação.
  const registryDb = action === "core-registry-report" ? createCoreDb() : db;
  const { data: runs, error: runsError } = await registryDb
    .from(runsTable)
    .select("result, created_at, actor_id")
    .eq("company_id", currentCompany())
    .order("created_at", { ascending: false })
    .limit(20);
  if (runsError) throw runsError;

  const liveCounts = {};
  const sample = {};
  for (const [section, table] of Object.entries(tables)) {
    const [{ count, error: countError }, { data: sampleRows, error: sampleError }] = await Promise.all([
      registryDb.from(table).select("*", { count: "exact", head: true })
        .eq("company_id", currentCompany()).is("archived_at", null),
      registryDb.from(table).select("*")
        .eq("company_id", currentCompany()).is("archived_at", null)
        .order("synced_at", { ascending: false }).limit(5),
    ]);
    if (countError) throw countError;
    if (sampleError) throw sampleError;
    liveCounts[section] = count || 0;
    sample[section] = sampleRows || [];
  }

  const summary = summarize({ runs: runs || [], liveCounts });
  return res.status(200).json({ ok: true, ...summary, liveCounts, sample });
}
