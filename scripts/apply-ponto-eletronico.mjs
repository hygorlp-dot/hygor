// scripts/apply-ponto-eletronico.mjs
//
// Aplica a migration 016 (app "Ponto de Obra", PONTO-001) no deploy de
// produção - mesmo padrão de apply-financial-engine-rls.mjs. A migration é
// idempotente (create if not exists / create or replace / drop trigger if
// exists): rodar de novo a cada deploy não muda nada.
//
// Manual: npm run ponto-eletronico:migrate (requer POSTGRES_URL_NON_POOLING)

import fs from "node:fs";
import postgres from "postgres";

if (process.env.VERCEL_ENV !== "production") {
  process.stdout.write("ponto-eletronico: ambiente não produtivo; migration automática ignorada.\n");
  process.exit(0);
}
if (!process.env.POSTGRES_URL_NON_POOLING) {
  throw new Error("ponto-eletronico: variável ausente: POSTGRES_URL_NON_POOLING.");
}

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl:"require", max:1, connect_timeout:20, idle_timeout:5 });
try {
  await sql.unsafe(fs.readFileSync(new URL("../migrations/016_create_ponto_eletronico.up.sql", import.meta.url), "utf8"));
  const [check] = await sql`
    select count(*)::int as tabelas, bool_and(relrowsecurity) as rls_ok
      from pg_class
     where relname in ('ponto_dispositivos','ponto_pareamentos','ponto_marcacoes','ponto_biometrias','ponto_responsaveis')
       and relnamespace = 'public'::regnamespace
  `;
  const [trava] = await sql`select count(*)::int as n from pg_trigger where tgname in ('ponto_marcacoes_no_update','ponto_marcacoes_no_delete')`;
  if (check?.tabelas !== 5 || !check?.rls_ok || trava?.n !== 2) {
    throw new Error("ponto-eletronico: a validação pós-migração não confirmou as 5 tabelas com RLS e a trava append-only.");
  }
  const [bucket] = await sql`
    select exists (select 1 from information_schema.tables where table_schema='storage' and table_name='buckets') as tem_storage
  `;
  if (bucket?.tem_storage) {
    const [b] = await sql`select count(*)::int as n from storage.buckets where id = 'ponto-obra'`;
    if (!b?.n) process.stdout.write("ponto-eletronico: AVISO - bucket privado 'ponto-obra' não existe; as fotos das marcações não serão gravadas até criá-lo no Supabase.\n");
  }
  process.stdout.write("ponto-eletronico: migration aplicada.\n");
} finally {
  await sql.end({ timeout:2 });
}
