// Restauração do backup do Ponto de Obra SÓ em banco DESCARTÁVEL e vazio
// (docs/PONTO-OBRA-BACKUP-RESTAURACAO.md). Nunca sobre produção.
//
//   PONTO_BACKUP_KEY=<base64> PONTO_RESTAURAR_URL=postgres://... node scripts/restaurar-backup-ponto.mjs \
//     --pacote <arquivo .arcdponto> --confirmo-descartavel=<host/banco do destino> [--fotos-em <pasta fora do repo>]
//
// Recusa se o destino (host/banco) for a origem do pacote ou o
// POSTGRES_URL_NON_POOLING, se estiver no mesmo servidor da produção, se não
// for confirmado ou se já tiver qualquer linha do ponto. O esquema é recriado pelo livro de
// migrations (migrations/ deste checkout) e tudo é conferido no fim.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { adaptadorPostgres } from "./migracoes-ponto/adaptadores.mjs";
import { aplicar } from "./migracoes-ponto/livro.mjs";
import { abrir, chaveDoAmbiente, manifestoDoEsquema, restaurar } from "./backup-ponto/pacote.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valor = nome => { const i = process.argv.indexOf(`--${nome}`); if (i >= 0) return process.argv[i + 1]; const a = process.argv.find(x => x.startsWith(`--${nome}=`)); return a ? a.slice(nome.length + 3) : null; };
const pacote = valor("pacote"), fotosEm = valor("fotos-em");
const url = process.env.PONTO_RESTAURAR_URL;
if (!pacote || !url) { console.error("uso: PONTO_RESTAURAR_URL=... --pacote <arquivo> --confirmo-descartavel=<host/banco>"); process.exit(1); }
const u = new URL(url), host = u.hostname, identidade = `${host}${u.pathname}`;
const manifesto = JSON.parse(fs.readFileSync(`${pacote}.manifest.json`, "utf8"));
const prod = process.env.POSTGRES_URL_NON_POOLING ? new URL(process.env.POSTGRES_URL_NON_POOLING) : null;
if (identidade === manifesto.origem || (prod && identidade === `${prod.hostname}${prod.pathname}`) || (prod && host === prod.hostname && !/^(localhost|127\.0\.0\.1)$/.test(host))) {
  console.error("recusado: o destino é o banco de origem ou está no servidor de produção"); process.exit(1);
}
if (valor("confirmo-descartavel") !== identidade) { console.error(`confirme que o destino é descartável: --confirmo-descartavel=${identidade}`); process.exit(1); }
if (fotosEm) { const d = path.resolve(fotosEm); if (d === raiz || d.startsWith(raiz + path.sep)) { console.error("recusado: fotos não podem ir para dentro do repositório"); process.exit(1); } }

const chave = chaveDoAmbiente(process.env.PONTO_BACKUP_KEY);
const dados = abrir({ corpo: fs.readFileSync(pacote), chave, manifesto });
const lerArquivo = arquivo => fs.readFileSync(path.join(raiz, "migrations", arquivo), "utf8");
const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(host) ? false : "require", onnotice: () => {} });
const conexao = await sql.reserve();
try {
  const db = adaptadorPostgres(conexao);
  const storage = fotosEm ? { enviar: async (c, b) => { const f = path.join(path.resolve(fotosEm), c); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b, { mode: 0o600 }); } } : null;
  const r = await restaurar({ db, dados, manifesto, storage,
    aplicarEsquema: async d => { await aplicar({ db, manifesto: await manifestoDoEsquema(d, lerArquivo), lerArquivo, origem: "restauracao" }); } });
  console.log(`Restaurado e conferido: ${r.tabelas} tabelas, ${r.linhas} linhas, ${r.fotos} foto(s); cadeias fiscais: ${r.fiscal.map(f => `NSR 1..${f.ultimoNsr} ${f.cadeiaIntegra ? "íntegra" : "QUEBRADA"}`).join("; ") || "nenhuma"}`);
} catch (e) {
  console.error(`restauração falhou: ${e.message}`);
  process.exitCode = 1;
} finally {
  conexao.release();
  await sql.end({ timeout: 5 });
}
