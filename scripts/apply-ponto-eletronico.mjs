// scripts/apply-ponto-eletronico.mjs
//
// Aplica as migrations do app "Ponto de Obra" no deploy de produção - mesmo
// padrão de apply-financial-engine-rls.mjs:
//   016 (PONTO-001): aparelhos, marcações legadas (formato 1), biometria;
//   017 (PONTO-002): estabelecimento fiscal, ARP e NSR por estabelecimento;
//   018 (PONTO-003): apropriação da jornada por obra (fora da ARP).
// As três são idempotentes (create if not exists / create or replace / drop
// trigger if exists): rodar de novo a cada deploy não muda nada. A 017 nunca
// reescreve dados da 016.
//
// Antes de reaplicar, passa pelo GATE do livro de migrations
// (scripts/migracoes-ponto/livro.mjs): hoje (sem livro e sem 019) segue igual
// a antes; com o livro ativo e íntegro não reaplica nada; deriva ou estado
// não interpretável faz o build FALHAR (a versão anterior continua no ar).
//
// Manual: npm run ponto-eletronico:migrate (requer POSTGRES_URL_NON_POOLING)

import fs from "node:fs";
import postgres from "postgres";
import { BUCKET_FOTOS_PONTO } from "../server/ponto-eletronico/fotos-caminho.js";
import { adaptadorPostgres } from "./migracoes-ponto/adaptadores.mjs";
import { guardaScriptAntigo, liberarTrava, obterTrava } from "./migracoes-ponto/livro.mjs";

if (process.env.VERCEL_ENV !== "production") {
  process.stdout.write("ponto-eletronico: ambiente não produtivo; migration automática ignorada.\n");
  process.exit(0);
}
if (!process.env.POSTGRES_URL_NON_POOLING) {
  throw new Error("ponto-eletronico: variável ausente: POSTGRES_URL_NON_POOLING.");
}
let hostDoBanco;
try { hostDoBanco = new URL(process.env.POSTGRES_URL_NON_POOLING).hostname; }
catch { throw new Error("ponto-eletronico: POSTGRES_URL_NON_POOLING inválida (o valor não é exibido)."); }
const local = /^(localhost|127\.0\.0\.1|::1|\[::1\])$/.test(hostDoBanco);

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: local ? false : "require", max:1, connect_timeout:20, idle_timeout:5, onnotice: () => {} });
// Conexão RESERVADA: a trava consultiva é de sessão; com o pool, uma
// reconexão no meio soltaria a trava sem aviso.
const conexao = await sql.reserve();
try {
  const db = adaptadorPostgres(conexao);
  const registrar = ev => process.stdout.write(`ponto-eletronico: [${ev.etapa}]${ev.ms !== undefined ? ` ${ev.ms} ms` : ""}${ev.tentativas ? ` (${ev.tentativas} tentativa(s))` : ""}\n`);
  // Mesma trava (com prazo) da CLI do livro: deploy e CLI não rodam juntos.
  const prazo = Number(process.env.PONTO_TRAVA_TIMEOUT_MS) > 0 ? Number(process.env.PONTO_TRAVA_TIMEOUT_MS) : 120_000;
  process.stdout.write(`ponto-eletronico: aguardando a trava do livro de migrations (até ${Math.round(prazo / 1000)} s)...\n`);
  await obterTrava(db, { timeoutMs: prazo, registrar });
  const lerArquivo = arquivo => fs.readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), "utf8");
  const guarda = await guardaScriptAntigo(db, { lerArquivo });
  process.stdout.write(`ponto-eletronico: gate ${guarda.resultado} (versão fiscal ${guarda.versaoFiscal || "-"}): ${guarda.motivos.join(" | ")}\n`);
  if (guarda.acao === "bloquear") {
    throw new Error(`ponto-eletronico: deploy bloqueado pelo gate (${guarda.resultado}). Nada foi reaplicado. Ver docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md.`);
  }
  if (guarda.acao === "pular") {
    process.stdout.write("ponto-eletronico: livro de migrations ativo e íntegro; nada reaplicado.\n");
  } else {
    await reaplicar016a018(conexao);
  }
  await liberarTrava(db, registrar);
} finally {
  conexao.release();
  await sql.end({ timeout:2 });
}

async function reaplicar016a018(c) {
  await c.unsafe(fs.readFileSync(new URL("../migrations/016_create_ponto_eletronico.up.sql", import.meta.url), "utf8"));
  await c.unsafe(fs.readFileSync(new URL("../migrations/017_ponto_arp_estabelecimento_nsr.up.sql", import.meta.url), "utf8"));
  await c.unsafe(fs.readFileSync(new URL("../migrations/018_ponto_apropriacoes.up.sql", import.meta.url), "utf8"));
  const [check] = await c`
    select count(*)::int as tabelas, bool_and(relrowsecurity) as rls_ok
      from pg_class
     where relname in ('ponto_dispositivos','ponto_pareamentos','ponto_marcacoes','ponto_biometrias','ponto_responsaveis')
       and relnamespace = 'public'::regnamespace
  `;
  const [trava] = await c`select count(*)::int as n from pg_trigger where tgname in ('ponto_marcacoes_no_update','ponto_marcacoes_no_delete')`;
  if (check?.tabelas !== 5 || !check?.rls_ok || trava?.n !== 2) {
    throw new Error("ponto-eletronico: a validação pós-migração não confirmou as 5 tabelas com RLS e a trava append-only.");
  }
  // 017: ARP com RLS, função de NSR e travas de imutabilidade.
  const [arp] = await c`
    select count(*)::int as tabelas, bool_and(relrowsecurity) as rls_ok
      from pg_class
     where relname in ('ponto_estabelecimentos','ponto_estabelecimento_obras','ponto_eventos','ponto_arp_contadores','ponto_arp_registros','ponto_tempo_verificacoes')
       and relnamespace = 'public'::regnamespace
  `;
  const [funcao] = await c`select count(*)::int as n from pg_proc where proname = 'ponto_arp_registrar'`;
  const [travasArp] = await c`select count(*)::int as n from pg_trigger where tgname in
    ('ponto_eventos_no_update','ponto_eventos_no_delete','ponto_eventos_so_arp','ponto_arp_registros_no_update','ponto_arp_registros_no_delete','ponto_arp_registros_so_arp','ponto_arp_contadores_protegido')`;
  if (arp?.tabelas !== 6 || !arp?.rls_ok || funcao?.n !== 1 || travasArp?.n !== 7) {
    throw new Error("ponto-eletronico: a validação da 017 não confirmou as 6 tabelas da ARP com RLS, a função de NSR e as travas de imutabilidade.");
  }
  // 018: apropriação (fora da ARP) com RLS, funções e auditoria imutável.
  const [aprop] = await c`
    select count(*)::int as tabelas, bool_and(relrowsecurity) as rls_ok
      from pg_class
     where relname in ('ponto_apropriacoes','ponto_apropriacoes_auditoria') and relnamespace = 'public'::regnamespace
  `;
  const [funcoesAprop] = await c`select count(*)::int as n from pg_proc where proname in ('ponto_apropriacao_salvar','ponto_apropriacao_cancelar')`;
  const [travasAprop] = await c`select count(*)::int as n from pg_trigger where tgname in ('ponto_apropriacoes_so_funcao','ponto_aprop_auditoria_no_update','ponto_aprop_auditoria_no_delete')`;
  if (aprop?.tabelas !== 2 || !aprop?.rls_ok || funcoesAprop?.n !== 2 || travasAprop?.n !== 3) {
    throw new Error("ponto-eletronico: a validação da 018 não confirmou as tabelas de apropriação com RLS, as funções e a auditoria imutável.");
  }
  const [bucket] = await c`
    select exists (select 1 from information_schema.tables where table_schema='storage' and table_name='buckets') as tem_storage
  `;
  if (bucket?.tem_storage) {
    const [b] = await c`select count(*)::int as n from storage.buckets where id = ${BUCKET_FOTOS_PONTO}`;
    if (!b?.n) process.stdout.write(`ponto-eletronico: AVISO - bucket privado '${BUCKET_FOTOS_PONTO}' não existe; as fotos das marcações não serão gravadas até criá-lo no Supabase.\n`);
  }
  process.stdout.write("ponto-eletronico: migration aplicada.\n");
}
