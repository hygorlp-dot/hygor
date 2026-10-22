// scripts/apply-manutencao-banco.mjs
//
// Aplica no deploy de produção as migrations que faltavam no banco:
//   006: arquivamento/restauração atômicos da quinzena de ponto
//        (attendance_archive_transaction / attendance_restore_transaction);
//   020: remove o índice único duplicado de financial_events.
// Roda antes de acesso-publico:migrate (019), que fecha o que for criado aqui.
// Ambas idempotentes. Falha o build se a verificação final não confirmar.
//
// Manual: npm run manutencao-banco:migrate (requer POSTGRES_URL_NON_POOLING)

import fs from "node:fs";
import postgres from "postgres";

if (process.env.VERCEL_ENV !== "production") {
  process.stdout.write("manutencao-banco: ambiente não produtivo; migration automática ignorada.\n");
  process.exit(0);
}
if (!process.env.POSTGRES_URL_NON_POOLING) {
  throw new Error("manutencao-banco: variável ausente: POSTGRES_URL_NON_POOLING.");
}

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl:"require", max:1, connect_timeout:20, idle_timeout:5 });
try {
  for (const arquivo of [
    "../migrations/006_attendance_archive_transaction.up.sql",
    "../migrations/020_remover_indice_duplicado_financial_events.up.sql",
  ]) await sql.unsafe(fs.readFileSync(new URL(arquivo, import.meta.url), "utf8"));
  const [funcoes] = await sql`
    select count(*)::int as n from pg_proc
     where pronamespace = 'public'::regnamespace and prosecdef
       and proname in ('attendance_archive_transaction','attendance_restore_transaction')`;
  const [indices] = await sql`
    select count(*)::int as n from pg_index x
     where x.indrelid = 'public.financial_events'::regclass and x.indisunique and x.indnatts = 4`;
  if (funcoes?.n !== 2 || indices?.n !== 1) {
    throw new Error(`manutencao-banco: verificação falhou (funções do arquivo de ponto: ${funcoes?.n}, índices únicos de 4 colunas em financial_events: ${indices?.n}).`);
  }
  process.stdout.write("manutencao-banco: arquivo de ponto instalado e índice duplicado removido.\n");
} finally {
  await sql.end({ timeout:2 });
}
