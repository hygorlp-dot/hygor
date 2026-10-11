// Backup cifrado das tabelas e fotos do Ponto de Obra
// (docs/PONTO-OBRA-BACKUP-RESTAURACAO.md). Rodar SÓ com autorização: o
// pacote contém CPF, vetor facial e fotos (cifrados).
//
//   PONTO_BACKUP_KEY=<base64 32 bytes> node scripts/backup-ponto.mjs \
//     --saida <pasta FORA do repositório> --autorizado-por "<nome>" \
//     [--com-fotos | --fotos-de-pasta <pasta>]
//
// Banco: POSTGRES_URL_NON_POOLING, transação REPEATABLE READ READ ONLY.
// Fotos: --com-fotos = bucket do Supabase (SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY); --fotos-de-pasta = pasta local (ensaio).
// Sem fotos, o pacote NÃO serve para recuperação integral.
//
// Saída: 0 = cópia consistente; 2 = com pendências ou sem fotos (ver
// manifesto); 3 = INCONSISTENTE (hash divergente, cadastro sem foto ou bucket
// mudando); 1 = falha. Nunca imprime URL, chave ou dado.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { adaptadorPostgres } from "./migracoes-ponto/adaptadores.mjs";
import { chaveDoAmbiente, empacotar, exportar } from "./backup-ponto/pacote.mjs";
import { storagePasta, storageSupabase } from "./backup-ponto/storages.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valor = nome => { const i = process.argv.indexOf(`--${nome}`); return i >= 0 ? process.argv[i + 1] : null; };
const dentroDoRepo = d => { const a = path.resolve(d); return a === raiz || a.startsWith(raiz + path.sep); };
const saida = valor("saida"), autorizadoPor = valor("autorizado-por"), comFotos = process.argv.includes("--com-fotos"), fotosDePasta = valor("fotos-de-pasta");
if (!saida || !autorizadoPor) { console.error("uso: --saida <pasta fora do repositório> --autorizado-por \"<nome>\" [--com-fotos | --fotos-de-pasta <pasta>]"); process.exit(1); }
if (comFotos && fotosDePasta) { console.error("use --com-fotos OU --fotos-de-pasta"); process.exit(1); }
if (dentroDoRepo(saida)) { console.error("recusado: o pacote não pode ficar dentro do repositório (risco de commit de dado sensível)"); process.exit(1); }
const chave = chaveDoAmbiente(process.env.PONTO_BACKUP_KEY);
if (!process.env.POSTGRES_URL_NON_POOLING) { console.error("POSTGRES_URL_NON_POOLING ausente"); process.exit(1); }

async function origemDasFotos() {
  if (fotosDePasta) return storagePasta(path.resolve(fotosDePasta));
  if (!comFotos) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return storageSupabase(createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage.from("ponto-obra"));
}

const urlOrigem = new URL(process.env.POSTGRES_URL_NON_POOLING);
const identidade = `${urlOrigem.hostname}${urlOrigem.pathname}`;   // host/banco (sem credenciais)
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { max: 1, ssl: /^(localhost|127\.0\.0\.1)$/.test(urlOrigem.hostname) ? false : "require", connect_timeout: 20, onnotice: () => {} });
const conexao = await sql.reserve();
try {
  await conexao.unsafe("set default_transaction_read_only = on");
  const dados = await exportar({ db: adaptadorPostgres(conexao), storage: await origemDasFotos() });
  const agora = new Date().toISOString();
  const { manifesto, corpo } = await empacotar({ dados, chave, agora, origem: identidade, autorizadoPor });
  fs.mkdirSync(path.resolve(saida), { recursive: true });
  const nome = `ponto-${agora.replace(/[:.]/g, "-")}.arcdponto`;
  fs.writeFileSync(path.join(path.resolve(saida), nome), corpo, { mode: 0o600 });
  fs.writeFileSync(path.join(path.resolve(saida), `${nome}.manifest.json`), JSON.stringify(manifesto, null, 2));
  const c = manifesto.fotos.consistencia;
  console.log(`Backup do ponto: ${nome} (${corpo.length} bytes cifrados), ${Object.values(manifesto.tabelas).reduce((s, t) => s + t.linhas, 0)} linhas, ${manifesto.fotos.quantidade} foto(s); cadeias fiscais íntegras: ${manifesto.fiscal.every(f => f.cadeiaIntegra && f.contadorConfere)}`);
  console.log(`Consistência banco x Storage: ${c.qualidade}${c.semArquivo ? ` (referências sem arquivo: ${c.semArquivo.length}, órfãos: ${c.orfaos.length}, hash divergente: ${c.hashDivergente.length}, tentativas: ${c.tentativas})` : ""}`);
  process.exitCode = c.qualidade === "consistente" ? 0 : c.qualidade === "inconsistente" ? 3 : 2;
} catch (e) {
  console.error(`backup falhou: ${e.message}`);
  process.exitCode = 1;
} finally {
  conexao.release();
  await sql.end({ timeout: 5 });
}
