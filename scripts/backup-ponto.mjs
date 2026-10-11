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
// Sem fotos, o pacote NÃO serve para recuperação integral. As fotos vão
// para o arquivo uma a uma, já cifradas (o tamanho do bucket não fica na
// memória); o pacote só ganha o nome final se tudo terminar.
//
// Saída: 0 = cópia consistente; 2 = com pendências ou sem fotos (ver
// manifesto); 3 = INCONSISTENTE (hash divergente, cadastro sem foto ou bucket
// mudando); 1 = falha. Nunca imprime URL, chave ou dado.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { BUCKET_FOTOS_PONTO } from "../server/ponto-eletronico/fotos-caminho.js";
import { adaptadorPostgres } from "./migracoes-ponto/adaptadores.mjs";
import { dentroDe, hostDe, hostLocal, identidadeBanco } from "./migracoes-ponto/locais.mjs";
import { chaveDoAmbiente, exportar, novoPacote, saidaArquivo } from "./backup-ponto/pacote.mjs";
import { storagePasta, storageSupabase } from "./backup-ponto/storages.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valor = nome => { const i = process.argv.indexOf(`--${nome}`); return i >= 0 ? process.argv[i + 1] : null; };
const saida = valor("saida"), autorizadoPor = valor("autorizado-por"), comFotos = process.argv.includes("--com-fotos"), fotosDePasta = valor("fotos-de-pasta");
if (!saida || !autorizadoPor) { console.error("uso: --saida <pasta fora do repositório> --autorizado-por \"<nome>\" [--com-fotos | --fotos-de-pasta <pasta>]"); process.exit(1); }
if (comFotos && fotosDePasta) { console.error("use --com-fotos OU --fotos-de-pasta"); process.exit(1); }
if (dentroDe(raiz, saida)) { console.error("recusado: o pacote não pode ficar dentro do repositório (risco de commit de dado sensível)"); process.exit(1); }
let chave;
try { chave = chaveDoAmbiente(process.env.PONTO_BACKUP_KEY); } catch (e) { console.error(e.message); process.exit(1); }
if (!process.env.POSTGRES_URL_NON_POOLING) { console.error("POSTGRES_URL_NON_POOLING ausente"); process.exit(1); }
let identidade, host;
try { identidade = identidadeBanco(process.env.POSTGRES_URL_NON_POOLING); host = hostDe(process.env.POSTGRES_URL_NON_POOLING); }
catch (e) { console.error(e.message); process.exit(1); }

async function origemDasFotos() {
  if (fotosDePasta) return storagePasta(path.resolve(fotosDePasta));
  if (!comFotos) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return storageSupabase(createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage.from(BUCKET_FOTOS_PONTO));
}

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { max: 1, ssl: hostLocal(host) ? false : "require", connect_timeout: 20, onnotice: () => {} });
const conexao = await sql.reserve();
const agora = new Date().toISOString();
const pasta = path.resolve(saida), nome = `ponto-${agora.replace(/[:.]/g, "-")}.arcdponto`;
const final = path.join(pasta, nome), parcial = `${final}.parcial`;
let pacote = null;
try {
  await conexao.unsafe("set default_transaction_read_only = on");
  fs.mkdirSync(pasta, { recursive: true });
  pacote = novoPacote({ chave, saida: saidaArquivo(parcial) });
  const dados = await exportar({ db: adaptadorPostgres(conexao), storage: await origemDasFotos(), pacote });
  const manifesto = await pacote.finalizar({ dados, agora, origem: identidade, autorizadoPor });
  fs.renameSync(parcial, final);
  fs.writeFileSync(`${final}.manifest.json`, JSON.stringify(manifesto, null, 2), { mode: 0o600 });
  const c = manifesto.fotos.consistencia;
  console.log(`Backup do ponto: ${nome} (${fs.statSync(final).size} bytes cifrados), ${Object.values(manifesto.tabelas).reduce((s, t) => s + t.linhas, 0)} linhas, ${manifesto.fotos.quantidade} foto(s); cadeias fiscais íntegras: ${manifesto.fiscal.every(f => f.cadeiaIntegra && f.contadorConfere)}`);
  console.log(`Consistência banco x Storage: ${c.qualidade}${c.qualidade !== "sem_fotos" ? ` (referências sem arquivo: ${c.semArquivo}, órfãos: ${c.orfaos}, hash divergente: ${c.hashDivergente}, tentativas: ${c.tentativas})` : ""}`);
  process.exitCode = c.qualidade === "consistente" ? 0 : c.qualidade === "inconsistente" ? 3 : 2;
} catch (e) {
  console.error(`backup falhou: ${String(e.message || e).slice(0, 300)}`);
  try { pacote?.saida.fechar(); } catch { /* já fechado */ }
  fs.rmSync(parcial, { force: true });
  process.exitCode = 1;
} finally {
  conexao.release();
  await sql.end({ timeout: 5 });
}
