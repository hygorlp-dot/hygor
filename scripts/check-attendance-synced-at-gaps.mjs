// scripts/check-attendance-synced-at-gaps.mjs
//
// Trava de segurança #2 (04/09/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md):
// script só de LEITURA (nenhum insert/update/upsert) que varre a linha meta
// de Ponto e cada linha por obra em busca de células (funcionário/dia) que
// ainda dependem da ordem física da linha para desempatar - o mesmo sintoma
// que fez 6 funcionários mudarem de obra sozinhos na tela em 04/09/2026,
// antes do backfill daquele dia. A trava de código em
// mergeAttendanceObjects já impede a maioria dos casos (valor real nunca
// perde para tombstone alheio), mas os casos com dois valores REAIS
// conflitantes ainda são um risco - rodar isto periodicamente (ou sempre
// que o sintoma "obra mudou sozinha" for relatado de novo) é o jeito de
// achar esses casos antes que virem reclamação.
//
// Uso:
//   npm run attendance:check-synced-at-gaps
//
// Requer as mesmas variáveis de ambiente do resto do backend
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from "@supabase/supabase-js";
import { decodeAppData } from "../server/data-codec.js";
import { attendanceObraKeyPrefix, obraBucketFromKey } from "../server/attendance-obra-routing.js";
import { findAttendanceSyncedAtGaps, formatAttendanceSyncedAtGapsReport } from "../server/attendance-synced-at-audit.js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`check-attendance-synced-at-gaps: variáveis ausentes: ${missing.join(", ")}.`);
}

const companyId = process.env.COMPANY_ID || "arcd";
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const db = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const KEY = "arced_ponto_v1";
const PONTO_KEY = `${KEY}__ponto`;
const PONTO_OBRA_KEY_PREFIX = attendanceObraKeyPrefix(PONTO_KEY);

const [{ data: metaRow, error: metaError }, { data: obraRows, error: obraError }] = await Promise.all([
  db.from("company_app_data").select("value").eq("company_id", companyId).eq("key", PONTO_KEY).maybeSingle(),
  db.from("company_app_data").select("key,value").eq("company_id", companyId).like("key", `${PONTO_OBRA_KEY_PREFIX}%`),
]);
if (metaError) throw metaError;
if (obraError) throw obraError;

const sources = [];
if (metaRow) {
  const payload = decodeAppData(metaRow.value);
  sources.push({ label: "PONTO_META", attendance: payload?.attendance, syncedAt: payload?.attendanceSyncedAt });
}
for (const row of obraRows || []) {
  const bucket = obraBucketFromKey(PONTO_KEY, row.key);
  const payload = decodeAppData(row.value);
  sources.push({ label: `OBRA:${bucket}`, attendance: payload?.attendance, syncedAt: payload?.attendanceSyncedAt });
}

const summary = findAttendanceSyncedAtGaps(sources);
process.stdout.write(`${formatAttendanceSyncedAtGapsReport(summary).join("\n")}\n`);
if (summary.conflictingCells > 0) process.exitCode = 1;
