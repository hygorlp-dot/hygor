// scripts/apply-financial-engine-rls.mjs
//
// Fecha a lacuna de segurança das tabelas do motor financeiro (24/08/2026,
// ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, migration 012). Só DDL puro
// (enable RLS + revoke + grant) - não há nada para sincronizar em lote.
//
// Rodar manualmente contra produção, se precisar aplicar a migration antes
// do próximo deploy (o prebuild já faz isso automaticamente):
//
//   npm run financial-engine:rls
//
// Requer POSTGRES_URL_NON_POOLING (mesmas variáveis do resto do backend).

import fs from "node:fs";
import postgres from "postgres";

if (process.env.VERCEL_ENV !== "production") {
  process.stdout.write("financial-engine-rls: ambiente não produtivo; migration automática ignorada.\n");
  process.exit(0);
}

if (!process.env.POSTGRES_URL_NON_POOLING) {
  throw new Error("financial-engine-rls: variável ausente: POSTGRES_URL_NON_POOLING.");
}

const sql=postgres(process.env.POSTGRES_URL_NON_POOLING, {
  ssl:"require", max:1, connect_timeout:20, idle_timeout:5,
});

try {
  await sql.unsafe(fs.readFileSync(
    new URL("../migrations/012_financial_engine_rls.up.sql", import.meta.url),
    "utf8",
  ));
  const [check]=await sql`
    select bool_and(relrowsecurity) as rls_ok
      from pg_class
     where relname in (
       'financial_titles','settlements','financial_events',
       'reconciliation_links','data_quality_cases','financial_shadow_runs'
     ) and relnamespace='public'::regnamespace
  `;
  if (!check?.rls_ok) throw new Error("financial-engine-rls: a validação pós-migração não confirmou RLS em todas as tabelas.");
  process.stdout.write("financial-engine-rls: migration aplicada.\n");
} finally {
  await sql.end({ timeout:2 });
}
