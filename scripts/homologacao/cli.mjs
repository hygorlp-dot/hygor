// Linha de comando da HOMOLOGAÇÃO ISOLADA do Ponto de Obra
// (docs/PONTO-OBRA-HOMOLOGACAO.md). Nunca imprime URL, senha ou PIN.
//
//   PONTO_HOMOLOGACAO_DB_URL=postgres://... node scripts/homologacao/cli.mjs conferir [--api https://<homologacao>/api/data]
//   PONTO_HOMOLOGACAO_DB_URL=... PONTO_HOMOLOGACAO_PIN=<4-8 números> node scripts/homologacao/cli.mjs provisionar --confirmo-homologacao=<usuario@host:porta/banco>
//   PONTO_HOMOLOGACAO_DB_URL=... node scripts/homologacao/cli.mjs codigo [--obra homolog-obra-1]
//   PONTO_HOMOLOGACAO_DB_URL=... node scripts/homologacao/cli.mjs resetar --confirmo-homologacao=<usuario@host:porta/banco>
//     (com PONTO_HOMOLOGACAO_SUPABASE_URL e PONTO_HOMOLOGACAO_SERVICE_ROLE_KEY, também limpa o Storage de teste)
//   node scripts/homologacao/cli.mjs validar-env --arquivo <.env do projeto Vercel de homologação>
//     (não conecta em nada: confere as variáveis antes de configurar a Vercel)
//
// Guardas (todas): o banco precisa estar marcado (comment on database ...
// 'arcd-ponto-homologacao', posto pelo operador no projeto NOVO); não pode
// ser a identidade nem o projeto Supabase de POSTGRES_URL_NON_POOLING /
// PONTO_PRODUCAO_DB_URL (se estiverem no ambiente); não pode ter registros do
// ponto ou dados do ERP reais sem o marcador de homologação.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { adaptadorPostgres } from "../migracoes-ponto/adaptadores.mjs";
import { hostDe, hostLocal, identidadeBanco } from "../migracoes-ponto/locais.mjs";
import { conferir, evidenciaDeProjeto, gerarCodigoPareamento, limparStorageHomologacao, provisionar, recusasDoDestino, resetar, validarVariaveisDeHomologacao } from "./homologacao.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { ehHostDeProducao } = createRequire(import.meta.url)("../../apps/ponto-obra/config/ambiente.js");
const valor = nome => { const i = process.argv.indexOf(`--${nome}`); if (i >= 0) return process.argv[i + 1]; const a = process.argv.find(x => x.startsWith(`--${nome}=`)); return a ? a.slice(nome.length + 3) : null; };
const sair = (m, codigo = 1) => { console.error(m); process.exit(codigo); };
const comando = process.argv[2];
if (!["provisionar", "conferir", "codigo", "resetar", "validar-env"].includes(comando)) sair("uso: cli.mjs <provisionar|conferir|codigo|resetar|validar-env> (ver o cabeçalho do arquivo)");

// validar-env: só lê o arquivo; nunca imprime valores.
if (comando === "validar-env") {
  const arquivo = valor("arquivo");
  if (!arquivo || !fs.existsSync(arquivo)) sair("informe --arquivo <.env do projeto Vercel de homologação>");
  const vars = Object.fromEntries(fs.readFileSync(arquivo, "utf8").split(/\r?\n/)
    .filter(l => /^\s*[A-Z_][A-Z0-9_]*\s*=/.test(l))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
  let identidadeDoBanco = null;
  try { identidadeDoBanco = process.env.PONTO_HOMOLOGACAO_DB_URL ? identidadeBanco(process.env.PONTO_HOMOLOGACAO_DB_URL) : null; } catch { /* sem comparação */ }
  const r = validarVariaveisDeHomologacao(vars, { identidadeDoBanco });
  console.log(`Variáveis do projeto Vercel de homologação: ${Object.keys(vars).length} lidas (valores não exibidos)`);
  for (const e of r.erros) console.log(`  ERRO  ${e}`);
  for (const a of r.avisos) console.log(`  aviso ${a}`);
  console.log(r.erros.length ? "NO-GO: corrija antes de configurar a Vercel." : "OK para configurar a Vercel de homologação.");
  process.exit(r.erros.length ? 1 : 0);
}

const url = process.env.PONTO_HOMOLOGACAO_DB_URL;
if (!url) sair("PONTO_HOMOLOGACAO_DB_URL ausente (banco do projeto de HOMOLOGAÇÃO)");
let identidade, host;
try { identidade = identidadeBanco(url); host = hostDe(url); } catch (e) { sair(e.message); }
const producao = [];
for (const nome of ["POSTGRES_URL_NON_POOLING", "PONTO_PRODUCAO_DB_URL"]) {
  if (!process.env[nome]) continue;
  try { producao.push(identidadeBanco(process.env[nome])); } catch { sair(`${nome} inválida (o valor não é exibido)`); }
}
if (process.env.POSTGRES_URL_NON_POOLING && process.env.POSTGRES_URL_NON_POOLING === url) sair("recusado: PONTO_HOMOLOGACAO_DB_URL é a mesma URL de POSTGRES_URL_NON_POOLING (produção)");

const lerArquivo = arquivo => {
  if (!/^[0-9]{3}_[a-z0-9_]+\.up\.sql$/.test(arquivo)) throw new Error("nome de migration inválido");
  return fs.readFileSync(path.join(raiz, "migrations", arquivo), "utf8");
};
const sql = postgres(url, { max: 1, ssl: hostLocal(host) ? false : "require", connect_timeout: 20, onnotice: () => {} });
const conexao = await sql.reserve();
try {
  const db = adaptadorPostgres(conexao);
  const confirmacao = valor("confirmo-homologacao");
  const recusas = await recusasDoDestino(db, {
    identidade, identidadesProducao: producao, exigirMarcador: comando !== "provisionar",
    // conferir e codigo não alteram esquema: dispensam a confirmação por extenso.
    confirmacao: ["conferir", "codigo"].includes(comando) ? identidade : confirmacao,
  });
  if (recusas.length) { console.error("RECUSADO:"); for (const r of recusas) console.error(`  - ${r}`); process.exitCode = 1; }
  else if (comando === "provisionar") {
    const esquemaErp = fs.readFileSync(path.join(raiz, "schema.sql"), "utf8");
    const manifesto = JSON.parse(fs.readFileSync(path.join(raiz, "scripts/migracoes-ponto/manifesto-com-019.json"), "utf8")).migracoes;
    const r = await provisionar(db, { esquemaErp, manifesto, lerArquivo, pinEncarregado: process.env.PONTO_HOMOLOGACAO_PIN });
    console.log(`Homologação provisionada (NÃO OFICIAL): gate ${r.gate}, bucket ${r.bucket}`);
    for (const l of r.livro) console.log(`  ${l}`);
    console.log(`  semente: ${r.semente.obras} obras, ${r.semente.trabalhadores} trabalhadores sintéticos, ${r.semente.terceirizados} terceirizado, ${r.semente.estabelecimento}`);
  } else if (comando === "conferir") {
    const r = await conferir(db, { lerArquivo });
    console.log(`Banco de homologação: marcador ${r.marcador}, gate ${r.gate}, dados sintéticos ${r.dadosSinteticos} (${r.trabalhadores} trabalhadores), bucket ${r.bucket}`);
    const ev = evidenciaDeProjeto(identidade);
    console.log(`  projeto Supabase: ${ev.reconhecido ? `hash do ref ${ev.hashPrefixo}… ${ev.ehProducao ? "= PRODUÇÃO (NO-GO)" : "≠ produção"}` : "não é Supabase reconhecível (conferir à mão)"}`);
    if (ev.ehProducao) process.exitCode = 2;
    console.log(`  aparelhos ${r.contagem.ponto_dispositivos}, eventos ${r.contagem.ponto_eventos}, registros fiscais (NSR de TESTE) ${r.contagem.ponto_arp_registros}, biometrias ${r.contagem.ponto_biometrias}`);
    const api = valor("api");
    if (api) {
      let u;
      try { u = new URL(api); } catch { sair("--api inválida"); }
      if (u.protocol !== "https:" || ehHostDeProducao(u.host)) sair("--api recusada: precisa ser https e NÃO pode ser a produção nem preview dela");
      const resp = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ponto-ambiente" }) });
      const json = await resp.json().catch(() => ({}));
      console.log(`  API ${u.host}: HTTP ${resp.status}, ambiente ${json.ambiente || json.code || "-"}`);
      if (json.ambiente !== "homologacao") process.exitCode = 2;
    }
    if (r.marcador !== "homologacao" || !r.gate.startsWith("GO") || !r.dadosSinteticos) process.exitCode = 2;
  } else if (comando === "codigo") {
    const r = await gerarCodigoPareamento(db, { obraId: valor("obra") || undefined });
    // Código de pareamento de TESTE, válido 30 min, só para o banco isolado.
    console.log(`Código de pareamento (homologação, obra ${r.obraId}, vale até ${r.expiraEm}): ${r.codigo}`);
  } else if (comando === "resetar") {
    await resetar(db);
    console.log("Esquema do ponto da homologação apagado (registros de TESTE). Rode 'provisionar' de novo.");
    const supaUrl = process.env.PONTO_HOMOLOGACAO_SUPABASE_URL, chave = process.env.PONTO_HOMOLOGACAO_SERVICE_ROLE_KEY;
    if (supaUrl && chave) {
      const { createClient } = await import("@supabase/supabase-js");
      const r = await limparStorageHomologacao({ storage: createClient(supaUrl, chave, { auth: { persistSession: false } }).storage, supabaseUrl: supaUrl, identidade });
      console.log(`Storage de homologação limpo: ${r.apagados} foto(s) de teste apagada(s).`);
    } else {
      console.log("Storage NÃO limpo (informe PONTO_HOMOLOGACAO_SUPABASE_URL e PONTO_HOMOLOGACAO_SERVICE_ROLE_KEY para apagar as fotos de teste).");
    }
  }
} catch (e) {
  console.error(`FALHA: ${String(e.message || e).slice(0, 300)}`);
  process.exitCode = 1;
} finally {
  conexao.release();
  await sql.end({ timeout: 5 });
}
