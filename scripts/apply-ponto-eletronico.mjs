// scripts/apply-ponto-eletronico.mjs
//
// Aplica as migrations do app "Ponto de Obra" no deploy de produção - mesmo
// padrão de apply-financial-engine-rls.mjs:
//   016 (PONTO-001): aparelhos, marcações legadas (formato 1), biometria;
//   017 (PONTO-002): estabelecimento fiscal, ARP e NSR por estabelecimento;
//   018 (PONTO-003): apropriação da jornada por obra (fora da ARP).
// As duas são idempotentes (create if not exists / create or replace / drop
// trigger if exists): rodar de novo a cada deploy não muda nada. A 017 nunca
// reescreve dados da 016.
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
  await sql.unsafe(fs.readFileSync(new URL("../migrations/017_ponto_arp_estabelecimento_nsr.up.sql", import.meta.url), "utf8"));
  await sql.unsafe(fs.readFileSync(new URL("../migrations/018_ponto_apropriacoes.up.sql", import.meta.url), "utf8"));
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
  // 017: ARP com RLS, função de NSR e travas de imutabilidade.
  const [arp] = await sql`
    select count(*)::int as tabelas, bool_and(relrowsecurity) as rls_ok
      from pg_class
     where relname in ('ponto_estabelecimentos','ponto_estabelecimento_obras','ponto_eventos','ponto_arp_contadores','ponto_arp_registros','ponto_tempo_verificacoes')
       and relnamespace = 'public'::regnamespace
  `;
  const [funcao] = await sql`select count(*)::int as n from pg_proc where proname = 'ponto_arp_registrar'`;
  const [travasArp] = await sql`select count(*)::int as n from pg_trigger where tgname in
    ('ponto_eventos_no_update','ponto_eventos_no_delete','ponto_eventos_so_arp','ponto_arp_registros_no_update','ponto_arp_registros_no_delete','ponto_arp_registros_so_arp','ponto_arp_contadores_protegido')`;
  if (arp?.tabelas !== 6 || !arp?.rls_ok || funcao?.n !== 1 || travasArp?.n !== 7) {
    throw new Error("ponto-eletronico: a validação da 017 não confirmou as 6 tabelas da ARP com RLS, a função de NSR e as travas de imutabilidade.");
  }
  // 018: apropriação (fora da ARP) com RLS, funções e auditoria imutável.
  const [aprop] = await sql`
    select count(*)::int as tabelas, bool_and(relrowsecurity) as rls_ok
      from pg_class
     where relname in ('ponto_apropriacoes','ponto_apropriacoes_auditoria') and relnamespace = 'public'::regnamespace
  `;
  const [funcoesAprop] = await sql`select count(*)::int as n from pg_proc where proname in ('ponto_apropriacao_salvar','ponto_apropriacao_cancelar')`;
  const [travasAprop] = await sql`select count(*)::int as n from pg_trigger where tgname in ('ponto_apropriacoes_so_funcao','ponto_aprop_auditoria_no_update','ponto_aprop_auditoria_no_delete')`;
  if (aprop?.tabelas !== 2 || !aprop?.rls_ok || funcoesAprop?.n !== 2 || travasAprop?.n !== 3) {
    throw new Error("ponto-eletronico: a validação da 018 não confirmou as tabelas de apropriação com RLS, as funções e a auditoria imutável.");
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
