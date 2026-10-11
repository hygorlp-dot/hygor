// Livro de migrations do Ponto de Obra - linha de comando MANUAL.
// NÃO está no prebuild: ligar ao deploy exige autorização
// (docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md).
//
//   node scripts/aplicar-migracoes-ponto.mjs                     # só planeja (não muda nada)
//   node scripts/aplicar-migracoes-ponto.mjs --verificar         # gate de deploy: GO / NO-GO / INTERVENCAO_HUMANA (só lê)
//   node scripts/aplicar-migracoes-ponto.mjs --aplicar --confirmo-banco=<host do banco>
//   ... --manifesto scripts/migracoes-ponto/manifesto-com-019.json   # janela da 019
//   ... --url-env NOME_DA_VARIAVEL                               # padrão POSTGRES_URL_NON_POOLING
//
// Sai com 1 em qualquer recusa do livro (arquivo alterado, estado parcial,
// migration posterior presente...). Nunca imprime a URL nem credenciais.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { adaptadorPostgres } from "./migracoes-ponto/adaptadores.mjs";
import { aplicar, planejar, verificarGate } from "./migracoes-ponto/livro.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = nome => { const a = process.argv.find(x => x === `--${nome}` || x.startsWith(`--${nome}=`)); if (!a) return null; return a.includes("=") ? a.slice(a.indexOf("=") + 1) : true; };
const valorDe = nome => { const i = process.argv.indexOf(`--${nome}`); return i >= 0 ? process.argv[i + 1] : arg(nome); };

const manifestoArq = path.resolve(raiz, valorDe("manifesto") || "scripts/migracoes-ponto/manifesto.json");
const manifesto = JSON.parse(fs.readFileSync(manifestoArq, "utf8")).migracoes;
const lerArquivo = arquivo => {
  if (!/^[0-9]{3}_[a-z0-9_]+\.up\.sql$/.test(arquivo)) throw new Error(`nome de migration inválido: ${arquivo}`);
  return fs.readFileSync(path.join(raiz, "migrations", arquivo), "utf8");
};
const nomeUrl = valorDe("url-env") || "POSTGRES_URL_NON_POOLING";
const url = process.env[nomeUrl];
if (!url) { console.error(`variável ${nomeUrl} ausente`); process.exit(1); }
const host = new URL(url).hostname;
const modoAplicar = arg("aplicar") === true;
if (modoAplicar && arg("confirmo-banco") !== host) {
  console.error(`para aplicar, confirme o banco: --confirmo-banco=${host}`);
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(host) ? false : "require", connect_timeout: 20, onnotice: () => {} });
const conexao = await sql.reserve();
try {
  const db = adaptadorPostgres(conexao);
  console.log(`Livro de migrations do Ponto - banco ${host} - manifesto ${path.relative(raiz, manifestoArq)} - ${modoAplicar ? "APLICAR" : "planejar (nada muda)"}`);
  if (arg("verificar") === true) {
    const g = await verificarGate(db, { lerArquivo });
    console.log(`Gate: ${g.resultado} (versão fiscal ${g.versaoFiscal || "-"})`);
    for (const m of g.motivos) console.log(`  - ${m}`);
    process.exitCode = g.resultado === "GO" ? 0 : g.resultado === "NO-GO" ? 2 : 3;
    process.exit();
  }
  const registrar = ev => console.log(`  [${ev.etapa}]${ev.arquivo ? ` ${ev.arquivo}` : ""}${ev.acao ? ` ${ev.acao}` : ""}${ev.ms !== undefined ? ` ${ev.ms} ms` : ""}${ev.tentativas ? ` (${ev.tentativas} tentativa(s))` : ""}`);
  const r = modoAplicar
    ? await aplicar({ db, manifesto, lerArquivo, registrar, origem: process.env.PONTO_LIVRO_ORIGEM || `manual:${process.env.USER || process.env.USERNAME || "desconhecido"}` })
    : await planejar({ db, manifesto, lerArquivo });
  if (!modoAplicar && !r.livroExiste) console.log("  (o livro ainda não existe: será criado ao aplicar)");
  for (const p of r.passos) console.log(`  ${p.acao.padEnd(20)} ${p.arquivo}  ${p.sha256.slice(0, 12)}…`);
  console.log(modoAplicar ? "Concluído." : "Plano pronto. Nada foi alterado.");
} catch (e) {
  console.error(`RECUSADO: ${e.message}`);
  process.exitCode = 1;
} finally {
  conexao.release();
  await sql.end({ timeout: 5 });
}
