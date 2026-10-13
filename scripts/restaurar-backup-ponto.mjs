// Restauração do backup do Ponto de Obra SÓ em banco DESCARTÁVEL e novo
// (docs/PONTO-OBRA-BACKUP-RESTAURACAO.md). Nunca sobre produção.
//
//   PONTO_BACKUP_KEY=<base64> PONTO_RESTAURAR_URL=postgres://... node scripts/restaurar-backup-ponto.mjs \
//     --pacote <arquivo .arcdponto> --confirmo-descartavel=<usuario@host:porta/banco do destino> \
//     [--fotos-em <pasta fora do repo e fora do OneDrive>] [--somente-fotos]
//
// Antes, o operador marca o banco descartável (ninguém faz isso em produção):
//   comment on database <banco> is 'arcd-ponto-descartavel';
//
// Recusa se: o destino (usuario@host:porta/banco) for a origem do pacote ou
// o POSTGRES_URL_NON_POOLING, ou estiver no mesmo servidor/projeto deles
// (exceto local); não tiver o marcador; não for confirmado; já tiver o
// esquema do ponto (exceto o que uma tentativa anterior desta ferramenta
// criou, vazio); ou se a pasta de fotos estiver no repositório ou no OneDrive
// (as fotos saem em CLARO). --somente-fotos: banco já restaurado e CONFERIDO.
//
// Estado e saída: completa (0); apenas_banco (2) e parcial (3) - NÃO
// satisfazem o gate de recuperação integral; falha (1).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { adaptadorPostgres } from "./migracoes-ponto/adaptadores.mjs";
import { aplicar } from "./migracoes-ponto/livro.mjs";
import { MARCADOR_DESCARTAVEL, dentroDe, hostDe, hostLocal, identidadeBanco, pastaSincronizada, projetoSupabase } from "./migracoes-ponto/locais.mjs";
import { abrir, chaveDoAmbiente, fonteArquivo, manifestoDoEsquema, restaurar } from "./backup-ponto/pacote.mjs";
import { storagePasta } from "./backup-ponto/storages.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valor = nome => { const i = process.argv.indexOf(`--${nome}`); if (i >= 0) return process.argv[i + 1]; const a = process.argv.find(x => x.startsWith(`--${nome}=`)); return a ? a.slice(nome.length + 3) : null; };
const sair = mensagem => { console.error(mensagem); process.exit(1); };
const pacote = valor("pacote"), fotosEm = valor("fotos-em"), somenteFotos = process.argv.includes("--somente-fotos");
const url = process.env.PONTO_RESTAURAR_URL;
if (!pacote || !url) sair("uso: PONTO_RESTAURAR_URL=... --pacote <arquivo> --confirmo-descartavel=<usuario@host:porta/banco>");
let identidade, host;
try { identidade = identidadeBanco(url); host = hostDe(url); } catch (e) { sair(e.message); }
const manifesto = JSON.parse(fs.readFileSync(`${pacote}.manifest.json`, "utf8"));
let prod = null;
try { prod = process.env.POSTGRES_URL_NON_POOLING ? identidadeBanco(process.env.POSTGRES_URL_NON_POOLING) : null; } catch { sair("POSTGRES_URL_NON_POOLING inválida (o valor não é exibido)"); }
// Mesmo servidor/projeto = mesmo usuario@host:porta (no pooler do Supabase o usuário carrega o projeto).
const servidor = id => String(id || "").split("/")[0];
// Mesmo projeto Supabase pelo pooler (postgres.<ref>@...) ou pelo acesso direto (db.<ref>.supabase.co).
const mesmoProjeto = id => !!projetoSupabase(id) && projetoSupabase(id) === projetoSupabase(identidade);
const mesmoServidor = id => !hostLocal(host) && (servidor(id) === servidor(identidade) || mesmoProjeto(id));
if (identidade === manifesto.origem || identidade === prod || mesmoServidor(manifesto.origem) || mesmoServidor(prod)) {
  sair("recusado: o destino é o banco de origem ou está no mesmo servidor/projeto da origem ou da produção");
}
if (valor("confirmo-descartavel") !== identidade) sair("confirme que o destino é descartável: --confirmo-descartavel=<usuario@host:porta/banco> (o mesmo da URL; o valor não é exibido)");
if (fotosEm && dentroDe(raiz, fotosEm)) sair("recusado: fotos não podem ir para dentro do repositório");
if (fotosEm && pastaSincronizada(fotosEm)) sair("recusado: as fotos saem em CLARO - não use pasta sincronizada com a nuvem (OneDrive)");
if (somenteFotos && !fotosEm) sair("--somente-fotos exige --fotos-em");

let chave, fonte, dados;
try { chave = chaveDoAmbiente(process.env.PONTO_BACKUP_KEY); } catch (e) { sair(e.message); }
try { fonte = fonteArquivo(pacote); dados = abrir({ fonte, chave, manifesto }); }
catch (e) { sair(`FALHA: pacote não abre (${String(e.message || e).slice(0, 200)})`); }
const lerArquivo = arquivo => {
  if (!/^[0-9]{3}_[a-z0-9_]+\.up\.sql$/.test(arquivo)) throw new Error("nome de migration inválido no pacote");
  return fs.readFileSync(path.join(raiz, "migrations", arquivo), "utf8");
};
const sql = postgres(url, { max: 1, ssl: hostLocal(host) ? false : "require", onnotice: () => {} });
const conexao = await sql.reserve();
const SAIDA = { completa: 0, apenas_banco: 2, parcial: 3, falha: 1 };
try {
  const [m] = await conexao`select shobj_description(oid, 'pg_database') as c from pg_database where datname = current_database()`;
  if (m?.c !== MARCADOR_DESCARTAVEL) {
    throw new Error(`o destino não está marcado como descartável. No banco descartável (nunca em produção): comment on database <banco> is '${MARCADOR_DESCARTAVEL}';`);
  }
  const db = adaptadorPostgres(conexao);
  const r = await restaurar({ db, dados, manifesto, somenteFotos, storage: fotosEm ? storagePasta(path.resolve(fotosEm)) : null,
    aplicarEsquema: async d => { await aplicar({ db, manifesto: await manifestoDoEsquema(d, lerArquivo), lerArquivo, origem: "restauracao" }); } });
  const cadeias = (r.banco?.fiscal || []).map(f => `NSR 1..${f.ultimoNsr} ${f.cadeiaIntegra && f.contadorConfere ? "íntegra" : "QUEBRADA"}`).join("; ") || "nenhuma";
  const fotos = r.fotos
    ? `fotos: ${r.fotos.verificadas}/${r.fotos.noPacote} verificadas por SHA-256${r.fotos.referencias != null ? `; ${r.fotos.referencias - r.fotos.referenciasSemFoto.length - r.fotos.referenciasDivergentes.length}/${r.fotos.referencias} registros do banco com a sua foto` : ""}`
    : `fotos: ${dados.consistencia?.qualidade !== "sem_fotos" ? `${dados.fotos.length} no pacote, não restauradas` : "pacote sem fotos"}`;
  const titulo = { completa: "RECUPERAÇÃO COMPLETA", apenas_banco: "RECUPERAÇÃO APENAS DO BANCO (não satisfaz o gate)", parcial: "RECUPERAÇÃO PARCIAL (não satisfaz o gate)", falha: "FALHA NA RECUPERAÇÃO" }[r.estado];
  console.log(`${titulo}: ${r.banco ? `${r.banco.tabelas} tabelas, ${r.banco.linhas} linhas conferidas; cadeias fiscais: ${cadeias}; ` : ""}${fotos}`);
  for (const mot of r.motivos) console.log(`  - ${mot}`);
  for (const lista of ["falhasEscrita", "ausentes", "corrompidas", "referenciasSemFoto", "referenciasDivergentes"]) for (const it of r.fotos?.[lista] || []) console.log(`  ${lista}: ${it.caminho}${it.motivo ? ` (${it.motivo})` : ""}`);
  process.exitCode = SAIDA[r.estado];
} catch (e) {
  console.error(`FALHA NA RECUPERAÇÃO: ${String(e.message || e).slice(0, 300)}`);
  process.exitCode = 1;
} finally {
  fonte?.fechar();
  conexao.release();
  await sql.end({ timeout: 5 });
}
