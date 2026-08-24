import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { decodeAppData } from "../server/data-codec.js";
import {
  buildEquipmentRegistrySnapshot,
  compareEquipmentRegistrySnapshot,
} from "../server/equipment-registry-shadow.js";

if (process.env.VERCEL_ENV !== "production") {
  process.stdout.write("CORE-002: ambiente não produtivo; migration automática ignorada.\n");
  process.exit(0);
}

const required=["POSTGRES_URL_NON_POOLING","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"];
const missing=required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`CORE-002: variáveis ausentes: ${missing.join(", ")}.`);
}

const company=process.env.COMPANY_ID || "arcd";
const key="arced_ponto_v1";
const actor="system:production-deploy";
const sql=postgres(process.env.POSTGRES_URL_NON_POOLING, {
  ssl:"require", max:1, connect_timeout:20, idle_timeout:5,
});
const db=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth:{ persistSession:false, autoRefreshToken:false },
});

try {
  await sql.unsafe(fs.readFileSync(
    new URL("../migrations/009_create_equipment_registry_projection.up.sql", import.meta.url),
    "utf8",
  ));
  const { data:row, error:loadError }=await db
    .from("company_app_data")
    .select("value")
    .eq("company_id", company)
    .eq("key", key)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!row?.value) {
    process.stdout.write("CORE-002: migration aplicada; não há dataset legado para projetar.\n");
    process.exitCode=0;
  } else {
    const snapshot=buildEquipmentRegistrySnapshot(decodeAppData(row.value));
    const [syncRow]=await sql`
      select public.equipment_registry_sync_legacy(
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
    const [equipment, owners, allocations, maintenanceEvents]=await Promise.all([
      all("core_equipment","id,source_hash,archived_at"),
      all("core_equipment_owners","id,source_hash,archived_at"),
      all("core_equipment_allocations","id,source_hash,archived_at"),
      all("core_equipment_maintenance_events","id,source_hash,archived_at"),
    ]);
    const divergences=compareEquipmentRegistrySnapshot(snapshot, {
      equipment, owners, allocations, maintenanceEvents,
    });
    if (divergences.length) {
      process.stderr.write(`CORE-002 detalhes: ${JSON.stringify(divergences.slice(0, 30))}\n`);
      throw new Error(`CORE-002: gate recusado; ${divergences.length} divergência(s) de equipamento.`);
    }
    process.stdout.write(
      `CORE-002: ${Object.entries(syncRow.result || {}).filter(([key]) => key !== "schemaVersion")
        .map(([key, value]) => `${key}=${value}`).join(", ")}; 0 divergências.\n`,
    );
  }
} finally {
  await sql.end({ timeout:2 });
}
