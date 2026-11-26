import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (process.env.VERCEL_ENV !== "production") process.exit(0);
if (!process.env.POSTGRES_URL_NON_POOLING) throw new Error("legacy-save-receipts: POSTGRES_URL_NON_POOLING ausente.");

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1, connect_timeout: 20, idle_timeout: 5 });
try {
  await sql.unsafe(await readFile(new URL("../migrations/024_legacy_save_receipts.up.sql", import.meta.url), "utf8"));
} finally {
  await sql.end({ timeout: 2 });
}
