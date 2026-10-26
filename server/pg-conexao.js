// Conexão Postgres reaproveitada entre chamadas da mesma instância da função.
//
// Antes, cada salvamento abria um cliente novo (TCP + TLS + autenticação) e o
// encerrava no fim. Medido contra o Supabase em outra região, isso custava
// várias idas e voltas só para "chegar" ao banco, antes de qualquer SQL. Agora
// a instância guarda o cliente e o devolve nas chamadas seguintes; o próprio
// driver fecha as conexões ociosas (`idle_timeout`) e reabre sob demanda.
//
// Cuidados que justificam o código abaixo:
// - Em serverless a instância pode ficar congelada e a conexão morrer sem o
//   cliente saber. Se o cliente ficou parado por mais de OCIOSO_PARA_VALIDAR_MS,
//   um `select 1` confirma que ele responde ANTES de abrir a transação; se
//   falhar, nada foi gravado e o cliente é recriado. Assim nunca precisamos
//   repetir uma transação com commit ambíguo.
// - Um erro de conexão no meio da operação descarta o cliente, para a próxima
//   chamada não herdar uma conexão quebrada.
// - PG_REUSE_CONNECTION=0 volta ao comportamento antigo (um cliente por
//   chamada) sem novo deploy de código, caso o Supabase acuse excesso de
//   conexões.
import postgres from "postgres";

export const OPCOES_PADRAO = Object.freeze({
  ssl: "require", max: 2, connect_timeout: 20, idle_timeout: 20,
});
export const OCIOSO_PARA_VALIDAR_MS = 3000;

const CODIGOS_DE_CONEXAO = new Set([
  "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "CONNECT_TIMEOUT",
  "ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED", "57P01",
]);

export const ehErroDeConexao = erro =>
  CODIGOS_DE_CONEXAO.has(erro?.code) || (!!erro?.cause && ehErroDeConexao(erro.cause));

export const criarGerenciadorSql = ({
  factory = postgres,
  url = () => process.env.POSTGRES_URL_NON_POOLING,
  reutilizar = () => process.env.PG_REUSE_CONNECTION !== "0",
  agora = () => Date.now(),
  opcoes = OPCOES_PADRAO,
} = {}) => {
  let cliente = null;
  let urlDoCliente = "";
  let ultimoUso = 0;

  const encerrar = cli => Promise.resolve().then(() => cli.end({ timeout: 0 })).catch(() => {});
  const esquecer = cli => { if (cliente === cli) cliente = null; return encerrar(cli); };

  const obter = async () => {
    const atual = url();
    if (cliente && urlDoCliente !== atual) await esquecer(cliente);
    if (cliente && agora() - ultimoUso > OCIOSO_PARA_VALIDAR_MS) {
      const candidato = cliente;
      try { await candidato`select 1`; } catch { await esquecer(candidato); }
    }
    if (!cliente) { cliente = factory(atual, opcoes); urlDoCliente = atual; }
    ultimoUso = agora();
    return cliente;
  };

  const comSql = async trabalho => {
    if (!reutilizar()) {
      const unico = factory(url(), { ...opcoes, max: 1, idle_timeout: 5 });
      try { return await trabalho(unico); } finally { await unico.end({ timeout: 2 }); }
    }
    const sql = await obter();
    try {
      return await trabalho(sql);
    } catch (erro) {
      if (ehErroDeConexao(erro)) await esquecer(sql);
      throw erro;
    } finally {
      ultimoUso = agora();
    }
  };

  const fechar = async () => { if (cliente) await esquecer(cliente); };
  return { comSql, fechar };
};

export const { comSql, fechar: fecharConexaoSql } = criarGerenciadorSql();
