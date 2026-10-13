// Guarda do prebuild para o projeto Vercel de HOMOLOGAÇÃO.
//
// O prebuild aplica migrations do ERP e do ponto ANTES de o servidor subir -
// e a recusa do servidor (server/ponto-eletronico/ambiente.js) só vale em
// execução. Um projeto de homologação configurado com o banco da produção
// rodaria as migrations na produção. Este guarda roda PRIMEIRO no prebuild e,
// só quando PONTO_AMBIENTE=homologacao, recusa o deploy se:
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou POSTGRES_URL_NON_POOLING (as
//     únicas variáveis de banco que os scripts do prebuild leem) forem do
//     projeto de produção ou de projetos diferentes entre si, ou faltar uma
//     obrigatória, ou houver segredo da produção copiado
//     (validarVariaveisDeHomologacao, a mesma do `cli.mjs validar-env`);
//   - o banco não tiver o comentário E o marcador da homologação (criados
//     pelo `cli.mjs provisionar`, que vem antes do primeiro deploy);
//   - o banco não responder (falha FECHADA).
//
// PRODUÇÃO: com PONTO_AMBIENTE ausente, "producao" ou qualquer outro valor,
// sai na hora com código 0, sem importar nada nem conectar em nada - o deploy
// de produção não muda. (Valor desconhecido já bloqueia o servidor do ponto em
// execução; aqui não se arrisca travar o deploy do ERP inteiro por isso.)
// Nenhum valor de variável é exibido.
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ehHomologacao = env => String(env?.PONTO_AMBIENTE ?? "").trim().toLowerCase() === "homologacao";

// conectar(url) -> { db: { query }, fechar() }. Devolve { acao, motivos }.
export async function guardaPrebuild({ env, conectar }) {
  if (!ehHomologacao(env)) return { acao: "ignorar", motivos: [] };
  const { MARCADOR_BANCO, comentarioDoBanco, marcadorDoBanco, validarVariaveisDeHomologacao } = await import("./homologacao.mjs");
  const { erros } = validarVariaveisDeHomologacao(env);
  if (erros.length) return { acao: "recusar", motivos: erros };
  let conexao = null;
  try {
    conexao = await conectar(env.POSTGRES_URL_NON_POOLING);
    const [comentario, marcador] = [await comentarioDoBanco(conexao.db), await marcadorDoBanco(conexao.db)];
    const motivos = [];
    if (comentario !== MARCADOR_BANCO) motivos.push("o banco não tem o comentário da homologação (rode `cli.mjs provisionar` antes do primeiro deploy)");
    if (marcador !== "homologacao") motivos.push("o banco não tem o marcador arcd_ambiente = homologacao (rode `cli.mjs provisionar` antes do primeiro deploy)");
    return motivos.length ? { acao: "recusar", motivos } : { acao: "ok", motivos: [] };
  } catch {
    return { acao: "recusar", motivos: ["não foi possível conferir o banco da homologação (falha fechada; o erro não é exibido por poder conter a URL)"] };
  } finally {
    await conexao?.fechar().catch(() => {});
  }
}

async function conectarPostgres(url) {
  const [{ default: postgres }, { adaptadorPostgres }, { hostDe, hostLocal }] = await Promise.all([
    import("postgres"), import("../migracoes-ponto/adaptadores.mjs"), import("../migracoes-ponto/locais.mjs")]);
  const sql = postgres(url, { max: 1, ssl: hostLocal(hostDe(url)) ? false : "require", connect_timeout: 20, onnotice: () => {} });
  return { db: adaptadorPostgres(sql), fechar: () => sql.end({ timeout: 5 }) };
}

const ehPrincipal = !!process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (ehPrincipal) {
  if (!ehHomologacao(process.env)) process.exit(0);
  const r = await guardaPrebuild({ env: process.env, conectar: conectarPostgres });
  if (r.acao === "ok") {
    console.log("guarda da homologação: variáveis e banco isolados conferidos (valores não exibidos).");
  } else {
    console.error("guarda da homologação: DEPLOY RECUSADO - este projeto declara PONTO_AMBIENTE=homologacao, mas:");
    for (const m of r.motivos) console.error(`  - ${m}`);
    process.exit(1);
  }
}
