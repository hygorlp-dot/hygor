import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { decodeAppData } from "../server/data-codec.js";
import { attendanceObraKeyPrefix, mergeAttendanceObjects } from "../server/attendance-obra-routing.js";
import {
  buildAttendanceRegistrySnapshot,
  compareAttendanceRegistrySnapshot,
} from "../server/attendance-registry-shadow.js";

if (process.env.VERCEL_ENV !== "production") {
  process.stdout.write("CORE-004: ambiente não produtivo; migration automática ignorada.\n");
  process.exit(0);
}

const required=["POSTGRES_URL_NON_POOLING","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"];
const missing=required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`CORE-004: variáveis ausentes: ${missing.join(", ")}.`);
}

const company=process.env.COMPANY_ID || "arcd";
const key="arced_ponto_v1";
const pontoKey=`${key}__ponto`;
// Achado de 02/09/2026 (Fase 1.5 reduzida): `data.attendance` não vive numa
// linha só - é particionado por obra (server/attendance-obra-routing.js).
// Reconstrói exatamente como api/data.js (lerLinha) faz: a cópia que sobra
// na linha core/meta é o fallback para qualquer obra que ainda não ganhou
// linha própria; cada linha de obra, quando existe, sempre vence esse
// fallback (mergeAttendanceObjects - fontes posteriores vencem).
const pontoObraPrefix=attendanceObraKeyPrefix(pontoKey);
const actor="system:production-deploy";
const sql=postgres(process.env.POSTGRES_URL_NON_POOLING, {
  ssl:"require", max:1, connect_timeout:20, idle_timeout:5,
});
const db=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth:{ persistSession:false, autoRefreshToken:false },
});

try {
  await sql.unsafe(fs.readFileSync(
    new URL("../migrations/015_create_attendance_registry_projection.up.sql", import.meta.url),
    "utf8",
  ));
  const [{ data:row, error:loadError }, { data:pontoObraRows, error:pontoObraError }]=await Promise.all([
    db.from("company_app_data").select("value")
      .eq("company_id", company).eq("key", key).maybeSingle(),
    db.from("company_app_data").select("key, value, updated_at")
      .eq("company_id", company).like("key", `${pontoObraPrefix}%`)
      .order("updated_at", { ascending:true }),
    ]);
  if (loadError) throw loadError;
  if (pontoObraError) throw pontoObraError;
  if (!row?.value) {
    process.stdout.write("CORE-004: migration aplicada; não há dataset legado para projetar.\n");
    process.exitCode=0;
  } else {
    const corePayload=decodeAppData(row.value);
    const attendanceSources=[
      corePayload.attendance || {},
      ...(pontoObraRows || []).map(item => decodeAppData(item.value)?.attendance || {}),
    ];
    const legacy={ ...corePayload, attendance:mergeAttendanceObjects(...attendanceSources) };
    const snapshot=buildAttendanceRegistrySnapshot(legacy);
    const [syncRow]=await sql`
      select public.attendance_registry_sync_legacy(
        ${company}, ${actor}, ${sql.json(snapshot)}
      ) as result
    `;
    const all=async(table, columns) => {
      const rows=[];
      for (let from=0;;from+=1000) {
        const { data, error }=await db.from(table).select(columns)
          .eq("company_id", company).range(from, from+999);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < 1000) break;
      }
      return rows;
    };
    const records=await all("core_attendance_records","id,source_hash,archived_at");
    const divergences=compareAttendanceRegistrySnapshot(snapshot, { records });
    if (divergences.length) {
      process.stderr.write(`CORE-004 detalhes: ${JSON.stringify(divergences.slice(0, 30))}\n`);
      throw new Error(`CORE-004: gate recusado; ${divergences.length} divergência(s) de ponto.`);
    }
    process.stdout.write(
      `CORE-004: ${Object.entries(syncRow.result || {}).filter(([field]) => field !== "schemaVersion")
        .map(([field, value]) => `${field}=${value}`).join(", ")}; 0 divergências.\n`,
    );
  }
} finally {
  await sql.end({ timeout:2 });
}
