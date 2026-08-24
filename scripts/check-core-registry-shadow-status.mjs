// scripts/check-core-registry-shadow-status.mjs
//
// Verificação/reforço do CORE-001 (22/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção "Fase 2"): a projeção
// cadastral em sombra (migrations/007_create_core_registry_projection,
// scripts/apply-core-registry-shadow.mjs) já grava um histórico completo
// em core_registry_shadow_runs a cada sincronização bem-sucedida, mas nada
// nunca consultou esse histórico - a única forma de saber se o gate está
// passando limpo era vasculhar o log bruto de build da Vercel.
//
// Este script é só LEITURA (nenhum insert/update/upsert): busca as últimas
// sincronizações e a contagem atual de linhas ativas de cada tabela core_*,
// e imprime um resumo legível via server/core-registry-shadow-status.js
// (lógica pura, testada em core-registry-shadow-status.test.js).
//
// Rodar contra produção:
//
//   npm run registry:shadow-status
//
// Requer as mesmas variáveis de ambiente do resto do backend
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from "@supabase/supabase-js";
import {
  CORE_REGISTRY_TABLES, formatCoreRegistryShadowStatus, summarizeCoreRegistryShadowStatus,
} from "../server/core-registry-shadow-status.js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`check-core-registry-shadow-status: variáveis ausentes: ${missing.join(", ")}.`);
}

const companyId = process.env.COMPANY_ID || "arcd";
// trim() defensivo: colar um JWT longo num terminal (PowerShell quebrando a
// linha dentro das aspas, por exemplo) facilmente introduz um \n/espaço nas
// pontas, o que quebra o header "Bearer <token>" de forma confusa (erro de
// fetch, não de credencial errada).
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const db = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: runs, error: runsError } = await db
  .from("core_registry_shadow_runs")
  .select("result, created_at, actor_id")
  .eq("company_id", companyId)
  .order("created_at", { ascending: false })
  .limit(20);
if (runsError) throw runsError;

const liveCounts = {};
for (const [section, table] of Object.entries(CORE_REGISTRY_TABLES)) {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("archived_at", null);
  if (error) throw error;
  liveCounts[section] = count || 0;
}

const summary = summarizeCoreRegistryShadowStatus({ runs: runs || [], liveCounts });
process.stdout.write(`${formatCoreRegistryShadowStatus(summary).join("\n")}\n`);
if (!summary.hasRuns || summary.warnings.length) process.exitCode = 1;
