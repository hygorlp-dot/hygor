// scripts/apply-acesso-publico.mjs
//
// Aplica a migration 019 (fecha o schema public para anon/authenticated) no
// deploy de produção. Roda por ÚLTIMO no prebuild: fecha também o que as
// migrations anteriores recriarem. Falha o build se sobrar qualquer tabela ou
// função SECURITY DEFINER acessível a anon/authenticated.
//
// Manual: npm run acesso-publico:migrate (requer POSTGRES_URL_NON_POOLING)

import fs from "node:fs";
import postgres from "postgres";

if (process.env.VERCEL_ENV !== "production") {
  process.stdout.write("acesso-publico: ambiente não produtivo; migration automática ignorada.\n");
  process.exit(0);
}
if (!process.env.POSTGRES_URL_NON_POOLING) {
  throw new Error("acesso-publico: variável ausente: POSTGRES_URL_NON_POOLING.");
}

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl:"require", max:1, connect_timeout:20, idle_timeout:5 });
try {
  await sql.unsafe(fs.readFileSync(new URL("../migrations/019_fechar_acesso_publico.up.sql", import.meta.url), "utf8"));
  const tabelas = await sql`
    select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m')
       and (has_table_privilege('anon', c.oid, 'select,insert,update,delete')
         or has_table_privilege('authenticated', c.oid, 'select,insert,update,delete'))`;
  const funcoes = await sql`
    select p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`;
  if (tabelas.length || funcoes.length) {
    throw new Error(`acesso-publico: ainda acessível ao público - tabelas: ${tabelas.map(t => t.relname).join(", ") || "nenhuma"}; funções: ${funcoes.map(f => f.proname).join(", ") || "nenhuma"}.`);
  }
  process.stdout.write("acesso-publico: migration aplicada; nenhuma tabela ou função SECURITY DEFINER aberta a anon/authenticated.\n");
} finally {
  await sql.end({ timeout:2 });
}
