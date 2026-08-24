// scripts/check-procurement-registry-shadow-status.mjs
//
// Verificação/reforço do CORE-003 (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção "Fase 2"): mesmo padrão de
// scripts/check-equipment-registry-shadow-status.mjs, adaptado para
// procurement_registry_shadow_runs (migration 014).
//
// Este script é só LEITURA (nenhum insert/update/upsert): busca as últimas
// sincronizações e a contagem atual de linhas ativas de core_quotations/
// core_purchase_orders, e imprime um resumo legível via
// server/procurement-registry-shadow-status.js (lógica pura, testada em
// procurement-registry-shadow-status.test.js).
//
// Rodar contra produção:
//
//   npm run procurement-registry:shadow-status
//
// Requer as mesmas variáveis de ambiente do resto do backend
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from "@supabase/supabase-js";
import {
  PROCUREMENT_REGISTRY_TABLES, formatProcurementRegistryShadowStatus, summarizeProcurementRegistryShadowStatus,
} from "../server/procurement-registry-shadow-status.js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`check-procurement-registry-shadow-status: variáveis ausentes: ${missing.join(", ")}.`);
}

const companyId = process.env.COMPANY_ID || "arcd";
// trim() defensivo: colar um JWT longo num terminal facilmente introduz
// \n/espaço nas pontas.
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const db = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: runs, error: runsError } = await db
  .from("procurement_registry_shadow_runs")
  .select("result, created_at, actor_id")
  .eq("company_id", companyId)
  .order("created_at", { ascending: false })
  .limit(20);
if (runsError) throw runsError;

const liveCounts = {};
for (const [section, table] of Object.entries(PROCUREMENT_REGISTRY_TABLES)) {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("archived_at", null);
  if (error) throw error;
  liveCounts[section] = count || 0;
}

const summary = summarizeProcurementRegistryShadowStatus({ runs: runs || [], liveCounts });
process.stdout.write(`${formatProcurementRegistryShadowStatus(summary).join("\n")}\n`);
if (!summary.hasRuns || summary.warnings.length) process.exitCode = 1;
