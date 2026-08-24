// scripts/apply-purchase-requests-live.mjs
//
// Primeira escrita transacional real de Fase 2 (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md). Diferente de
// apply-core-registry-shadow.mjs/apply-equipment-registry-shadow.mjs (que
// também fazem uma sincronização em lote a cada deploy), este script só
// aplica a migration (idempotente - create table if not exists) - não há
// nada para sincronizar em lote, porque a tabela `purchase_requests`
// recebe escrita ao vivo, um registro por vez, no momento em que
// SOLICITACAO_COMPRA_SALVA é processado (api/data.js, ação
// "operational-command").
//
// Rodar manualmente contra produção, se precisar aplicar a migration antes
// do próximo deploy (o prebuild já faz isso automaticamente):
//
//   npm run purchase-requests:migrate
//
// Requer POSTGRES_URL_NON_POOLING (mesmas variáveis do resto do backend).

import fs from "node:fs";
import postgres from "postgres";

if (process.env.VERCEL_ENV !== "production") {
  process.stdout.write("purchase_requests: ambiente não produtivo; migration automática ignorada.\n");
  process.exit(0);
}

if (!process.env.POSTGRES_URL_NON_POOLING) {
  throw new Error("purchase_requests: variável ausente: POSTGRES_URL_NON_POOLING.");
}

const sql=postgres(process.env.POSTGRES_URL_NON_POOLING, {
  ssl:"require", max:1, connect_timeout:20, idle_timeout:5,
});

// 011 (grant DELETE) e 013 (revoke DELETE) - achado de 24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md: reaplicar 011 em todo deploy
// tornava o privilégio permanente por omissão, apesar de documentado como
// uso único (limpeza de um registro de teste, já feita). 011 sai da cadeia
// recorrente; 013 revoga o que já tinha sido concedido - idempotente,
// seguro mesmo depois da primeira vez que rodar.
const migrationPaths=[
  "../migrations/010_create_purchase_requests_live.up.sql",
  "../migrations/013_revoke_purchase_requests_delete.up.sql",
];

try {
  for (const migrationPath of migrationPaths) {
    await sql.unsafe(fs.readFileSync(new URL(migrationPath, import.meta.url), "utf8"));
  }
  const [check]=await sql`select to_regclass('public.purchase_requests') is not null as table_ok`;
  if (!check?.table_ok) throw new Error("purchase_requests: a validação pós-migração não encontrou a tabela.");
  process.stdout.write("purchase_requests: migration aplicada.\n");
} finally {
  await sql.end({ timeout:2 });
}
