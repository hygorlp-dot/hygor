// Backup cifrado das tabelas e fotos do Ponto de Obra
// (docs/PONTO-OBRA-BACKUP-RESTAURACAO.md). Rodar SÓ com autorização: o
// pacote contém CPF, vetor facial e fotos (cifrados).
//
//   PONTO_BACKUP_KEY=<base64 32 bytes> node scripts/backup-ponto.mjs \
//     --saida <pasta FORA do repositório> --autorizado-por "<nome>" [--com-fotos]
//
// Conexão em modo SOMENTE LEITURA (default_transaction_read_only). Banco:
// POSTGRES_URL_NON_POOLING; fotos: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// Gera <nome>.arcdponto (cifrado) e <nome>.arcdponto.manifest.json (sem
// dado pessoal). Nunca imprime URL, chave ou dado.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { adaptadorPostgres } from "./migracoes-ponto/adaptadores.mjs";
import { chaveDoAmbiente, empacotar, exportar } from "./backup-ponto/pacote.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valor = nome => { const i = process.argv.indexOf(`--${nome}`); return i >= 0 ? process.argv[i + 1] : null; };
const saida = valor("saida"), autorizadoPor = valor("autorizado-por"), comFotos = process.argv.includes("--com-fotos");
if (!saida || !autorizadoPor) { console.error("uso: --saida <pasta fora do repositório> --autorizado-por \"<nome>\" [--com-fotos]"); process.exit(1); }
const destino = path.resolve(saida);
if (destino === raiz || destino.startsWith(raiz + path.sep)) { console.error("recusado: o pacote não pode ficar dentro do repositório (risco de commit de dado sensível)"); process.exit(1); }
const chave = chaveDoAmbiente(process.env.PONTO_BACKUP_KEY);
if (!process.env.POSTGRES_URL_NON_POOLING) { console.error("POSTGRES_URL_NON_POOLING ausente"); process.exit(1); }

async function storageSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage.from("ponto-obra");
  const listarTudo = async (prefixo = "") => {
    const itens = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await s.list(prefixo, { limit: 1000, offset });
      if (error) throw error;
      for (const it of data || []) {
        const caminho = prefixo ? `${prefixo}/${it.name}` : it.name;
        if (it.id) itens.push({ caminho }); else itens.push(...await listarTudo(caminho));
      }
      if ((data || []).length < 1000) break;
    }
    return itens;
  };
  return {
    listar: () => listarTudo(),
    baixar: async c => { const { data, error } = await s.download(c); if (error) throw error; return Buffer.from(await data.arrayBuffer()); },
  };
}

const urlOrigem = new URL(process.env.POSTGRES_URL_NON_POOLING);
const identidade = `${urlOrigem.hostname}${urlOrigem.pathname}`;   // host/banco (sem credenciais)
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { max: 1, ssl: /^(localhost|127\.0\.0\.1)$/.test(urlOrigem.hostname) ? false : "require", connect_timeout: 20, onnotice: () => {} });
const conexao = await sql.reserve();
try {
  await conexao.unsafe("set default_transaction_read_only = on");
  await conexao.unsafe("begin isolation level repeatable read read only");   // retrato consistente
  const dados = await exportar({ db: adaptadorPostgres(conexao), storage: comFotos ? await storageSupabase() : null });
  await conexao.unsafe("commit");
  const agora = new Date().toISOString();
  const { manifesto, corpo } = await empacotar({ dados, chave, agora, origem: identidade, autorizadoPor });
  fs.mkdirSync(destino, { recursive: true });
  const nome = `ponto-${agora.replace(/[:.]/g, "-")}.arcdponto`;
  fs.writeFileSync(path.join(destino, nome), corpo, { mode: 0o600 });
  fs.writeFileSync(path.join(destino, `${nome}.manifest.json`), JSON.stringify(manifesto, null, 2));
  console.log(`Backup do ponto: ${nome} (${corpo.length} bytes cifrados), ${Object.values(manifesto.tabelas).reduce((s, t) => s + t.linhas, 0)} linhas, ${manifesto.fotos.quantidade} foto(s); cadeias fiscais íntegras: ${manifesto.fiscal.every(f => f.cadeiaIntegra)}`);
} catch (e) {
  console.error(`backup falhou: ${e.message}`);
  process.exitCode = 1;
} finally {
  conexao.release();
  await sql.end({ timeout: 5 });
}
