// Restauração do backup do Ponto de Obra SÓ em banco DESCARTÁVEL e vazio
// (docs/PONTO-OBRA-BACKUP-RESTAURACAO.md). Nunca sobre produção.
//
//   PONTO_BACKUP_KEY=<base64> PONTO_RESTAURAR_URL=postgres://... node scripts/restaurar-backup-ponto.mjs \
//     --pacote <arquivo .arcdponto> --confirmo-descartavel=<host/banco do destino> \
//     [--fotos-em <pasta fora do repo>] [--somente-fotos]
//
// Recusa se o destino (host/banco) for a origem do pacote ou o
// POSTGRES_URL_NON_POOLING, se estiver no mesmo servidor da produção, se não
// for confirmado ou se já tiver qualquer linha do ponto (exceto com
// --somente-fotos, que exige o banco já restaurado e CONFERIDO).
//
// Estado e saída: completa (0) - banco conferido e todas as fotos
// restauradas e relidas por SHA-256; apenas_banco (2) e parcial (3) - NÃO
// satisfazem o gate de recuperação integral; falha (1).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { adaptadorPostgres } from "./migracoes-ponto/adaptadores.mjs";
import { aplicar } from "./migracoes-ponto/livro.mjs";
import { abrir, chaveDoAmbiente, manifestoDoEsquema, restaurar } from "./backup-ponto/pacote.mjs";
import { storagePasta } from "./backup-ponto/storages.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valor = nome => { const i = process.argv.indexOf(`--${nome}`); if (i >= 0) return process.argv[i + 1]; const a = process.argv.find(x => x.startsWith(`--${nome}=`)); return a ? a.slice(nome.length + 3) : null; };
const pacote = valor("pacote"), fotosEm = valor("fotos-em"), somenteFotos = process.argv.includes("--somente-fotos");
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
if (somenteFotos && !fotosEm) { console.error("--somente-fotos exige --fotos-em"); process.exit(1); }

let dados;
try { dados = abrir({ corpo: fs.readFileSync(pacote), chave: chaveDoAmbiente(process.env.PONTO_BACKUP_KEY), manifesto }); }
catch (e) { console.error(`FALHA: pacote não abre (${e.message})`); process.exit(1); }
const lerArquivo = arquivo => fs.readFileSync(path.join(raiz, "migrations", arquivo), "utf8");
const sql = postgres(url, { max: 1, ssl: /^(localhost|127\.0\.0\.1)$/.test(host) ? false : "require", onnotice: () => {} });
const conexao = await sql.reserve();
const SAIDA = { completa: 0, apenas_banco: 2, parcial: 3, falha: 1 };
try {
  const db = adaptadorPostgres(conexao);
  const r = await restaurar({ db, dados, manifesto, somenteFotos, storage: fotosEm ? storagePasta(path.resolve(fotosEm)) : null,
    aplicarEsquema: async d => { await aplicar({ db, manifesto: await manifestoDoEsquema(d, lerArquivo), lerArquivo, origem: "restauracao" }); } });
  const cadeias = (r.banco?.fiscal || []).map(f => `NSR 1..${f.ultimoNsr} ${f.cadeiaIntegra && f.contadorConfere ? "íntegra" : "QUEBRADA"}`).join("; ") || "nenhuma";
  const fotos = r.fotos ? `fotos: ${r.fotos.verificadas}/${r.fotos.noPacote} verificadas por SHA-256` : `fotos: ${manifesto.fotos.incluidas ? `${manifesto.fotos.quantidade} no pacote, não restauradas` : "pacote sem fotos"}`;
  const titulo = { completa: "RECUPERAÇÃO COMPLETA", apenas_banco: "RECUPERAÇÃO APENAS DO BANCO (não satisfaz o gate)", parcial: "RECUPERAÇÃO PARCIAL (não satisfaz o gate)", falha: "FALHA NA RECUPERAÇÃO" }[r.estado];
  console.log(`${titulo}: ${r.banco ? `${r.banco.tabelas} tabelas, ${r.banco.linhas} linhas conferidas; cadeias fiscais: ${cadeias}; ` : ""}${fotos}`);
  for (const m of r.motivos) console.log(`  - ${m}`);
  for (const lista of ["falhasEscrita", "ausentes", "corrompidas"]) for (const it of r.fotos?.[lista] || []) console.log(`  ${lista}: ${it.caminho}${it.motivo ? ` (${it.motivo})` : ""}`);
  process.exitCode = SAIDA[r.estado];
} catch (e) {
  console.error(`FALHA: ${e.message}`);
  process.exitCode = 1;
} finally {
  conexao.release();
  await sql.end({ timeout: 5 });
}
