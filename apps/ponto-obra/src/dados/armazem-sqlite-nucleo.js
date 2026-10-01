// Núcleo SQL do armazém do aparelho - recebe um banco com a API assíncrona do
// expo-sqlite (execAsync/getFirstAsync/getAllAsync/runAsync/
// withExclusiveTransactionAsync) e não importa nada do Expo, para os testes
// rodarem o MESMO SQL contra um SQLite real no Node (armazem-sqlite.test.js).
// Contrato: src/logica/armazem-memoria.js.
//
// Evento local nunca é alterado, apagado nem renumerado aqui. A
// sincronização só acrescenta, em colunas próprias, o que a ARP devolveu
// (nsr_fiscal, hash_fiscal, estabelecimento_fiscal, gravado_em) e o estado do
// envio/foto. sequencia_local é a sequência POR APARELHO - não é NSR.
//
// foto_enviada guarda o estado da foto: 0 = aguardando envio, 1 = enviada ou
// batida sem foto, -1 = arquivo não existe mais, -2 = recusada (arquivo
// preservado).
//
// formato: 2 = evento atual; 1 = LEGADO (versões antigas do app, colunas
// renomeadas na migração local abaixo, conteúdo intocado).
import { HASH_INICIAL } from "../../../../src/domains/ponto-eletronico/marcacao.js";

// Transações na MESMA conexão, serializadas em JavaScript.
//
// Por quê: o withExclusiveTransactionAsync do expo-sqlite abre uma conexão
// NOVA (useNewConnection) e não repete o "PRAGMA key" - com SQLCipher essa
// conexão não lê o banco cifrado e toda batida falharia no aparelho. Aqui a
// transação usa a conexão que já tem a chave (BEGIN IMMEDIATE) e TODA
// consulta passa pela mesma fila: leitura nunca enxerga batida de uma
// transação ainda aberta (que poderia ser desfeita).
export function serializarBanco(conexao) {
  let fila = Promise.resolve();
  const naFila = tarefa => { const r = fila.then(tarefa); fila = r.catch(() => {}); return r; };
  const direto = {
    execAsync: (...a) => conexao.execAsync(...a),
    getFirstAsync: (...a) => conexao.getFirstAsync(...a),
    getAllAsync: (...a) => conexao.getAllAsync(...a),
    runAsync: (...a) => conexao.runAsync(...a),
  };
  return {
    execAsync: (...a) => naFila(() => direto.execAsync(...a)),
    getFirstAsync: (...a) => naFila(() => direto.getFirstAsync(...a)),
    getAllAsync: (...a) => naFila(() => direto.getAllAsync(...a)),
    runAsync: (...a) => naFila(() => direto.runAsync(...a)),
    // Dentro de fn, use SÓ o txn recebido (chamar o banco de fora travaria a fila).
    withExclusiveTransactionAsync: fn => naFila(async () => {
      await direto.execAsync("BEGIN IMMEDIATE");
      try {
        await fn(direto);
        await direto.execAsync("COMMIT");
      } catch (e) {
        try { await direto.execAsync("ROLLBACK"); } catch { /* transação já desfeita */ }
        throw e;
      }
    }),
    closeAsync: () => naFila(() => conexao.closeAsync()),
  };
}

const colunasDe = async db => new Set((await db.getAllAsync("PRAGMA table_info(marcacoes)")).map(c => c.name));

export async function prepararBanco(db) {
  // FULL: cada batida confirmada vai para o disco antes de o app seguir -
  // queda de energia logo depois da batida não a desfaz (com WAL + NORMAL,
  // a última transação podia ser perdida).
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS marcacoes (
      sequencia_local INTEGER PRIMARY KEY NOT NULL,
      id TEXT NOT NULL UNIQUE,
      hash_local TEXT NOT NULL,
      hash_local_anterior TEXT NOT NULL,
      dados TEXT NOT NULL,
      formato INTEGER NOT NULL DEFAULT 2,
      enviada INTEGER NOT NULL DEFAULT 0,
      foto_enviada INTEGER NOT NULL DEFAULT 1,
      caminho_foto TEXT
    );
    CREATE TABLE IF NOT EXISTS estado (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);
  `);
  // Migração local de bancos de versões anteriores (formato 1): só renomeia
  // colunas e acrescenta as novas - nenhuma linha é reescrita.
  let cols = await colunasDe(db);
  if (cols.has("nsr") && !cols.has("sequencia_local")) await db.execAsync("ALTER TABLE marcacoes RENAME COLUMN nsr TO sequencia_local");
  cols = await colunasDe(db);
  if (cols.has("hash") && !cols.has("hash_local")) await db.execAsync("ALTER TABLE marcacoes RENAME COLUMN hash TO hash_local");
  cols = await colunasDe(db);
  if (cols.has("hash_anterior") && !cols.has("hash_local_anterior")) await db.execAsync("ALTER TABLE marcacoes RENAME COLUMN hash_anterior TO hash_local_anterior");
  cols = await colunasDe(db);
  // Linhas que já existiam antes desta coluna são do formato 1.
  if (!cols.has("formato")) await db.execAsync("ALTER TABLE marcacoes ADD COLUMN formato INTEGER NOT NULL DEFAULT 1");
  for (const [coluna, tipo] of [["motivo_foto", "TEXT"], ["nsr_fiscal", "INTEGER"], ["hash_fiscal", "TEXT"], ["estabelecimento_fiscal", "TEXT"], ["gravado_em", "TEXT"]]) {
    if (!cols.has(coluna)) await db.execAsync(`ALTER TABLE marcacoes ADD COLUMN ${coluna} ${tipo}`);
  }
}

// Linha -> evento. Formato 2 sai com os nomes do evento; formato 1 com os do legado.
const linhaParaEvento = l => (Number(l.formato) === 2
  ? { ...JSON.parse(l.dados), formatVersion: 2, localSequence: l.sequencia_local, localHash: l.hash_local, localPreviousHash: l.hash_local_anterior }
  // Formato 1: "nsr" é o nome do campo NO HASH legado (não muda); o valor é a
  // sequência do aparelho, exposta também como legacyDeviceSequence.
  : { ...JSON.parse(l.dados), formatVersion: 1, nsr: l.sequencia_local, legacyDeviceSequence: l.sequencia_local, hash: l.hash_local, hashAnterior: l.hash_local_anterior });

export function criarArmazemSobreBanco(db) {
  const lerEstado = async chave => { const l = await db.getFirstAsync("SELECT valor FROM estado WHERE chave = ?", chave); return l ? JSON.parse(l.valor) : null; };
  const gravarEstado = (alvo, chave, valor) => alvo.runAsync("INSERT INTO estado (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor", chave, JSON.stringify(valor));
  // base_cadeia só existe em bancos que passaram pelo realinhamento do
  // formato 1 (versões antigas); não é mais gravada.
  const baseDa = async alvo => {
    const l = await alvo.getFirstAsync("SELECT valor FROM estado WHERE chave = 'base_cadeia'");
    return l ? JSON.parse(l.valor) : { nsr: 0, hash: HASH_INICIAL };
  };
  const ultimo = async alvo => {
    const l = await alvo.getFirstAsync("SELECT sequencia_local, hash_local FROM marcacoes ORDER BY sequencia_local DESC LIMIT 1");
    const base = await baseDa(alvo);
    return l && l.sequencia_local > base.nsr ? { localSequence: l.sequencia_local, localHash: l.hash_local } : { localSequence: base.nsr, localHash: base.hash };
  };

  return {
    // Transação exclusiva: duas batidas simultâneas nunca pegam a mesma sequência local.
    async transacao(fn) {
      let resultado;
      await db.withExclusiveTransactionAsync(async txn => {
        resultado = await fn({
          ultimoEvento: () => ultimo(txn),
          async inserirEvento(e, { caminhoFoto = null } = {}) {
            const atual = await ultimo(txn);
            if (e.localSequence !== atual.localSequence + 1) throw new Error("sequência local fora de ordem no aparelho");
            const { localSequence, localHash, localPreviousHash, ...resto } = e;
            await txn.runAsync(
              "INSERT INTO marcacoes (sequencia_local, id, hash_local, hash_local_anterior, dados, formato, enviada, foto_enviada, caminho_foto) VALUES (?, ?, ?, ?, ?, 2, 0, ?, ?)",
              localSequence, e.eventId, localHash, localPreviousHash, JSON.stringify(resto), e.fotoSha256 ? 0 : 1, caminhoFoto || null,
            );
          },
        });
      });
      return resultado;
    },
    ultimoEventoGlobal: () => ultimo(db),
    async eventosPendentes(limite) {
      const linhas = await db.getAllAsync("SELECT * FROM marcacoes WHERE enviada = 0 ORDER BY sequencia_local LIMIT ?", Math.min(limite, 1_000_000));
      return linhas.map(linhaParaEvento);
    },
    // Formato 2: a ARP aceitou ESTE evento. Só colunas fiscais e "enviada"
    // mudam; dados, hash local e sequência local ficam como estavam.
    async confirmarEvento(eventId, fiscal) {
      const r = await db.runAsync(
        "UPDATE marcacoes SET enviada = 1, nsr_fiscal = ?, hash_fiscal = ?, estabelecimento_fiscal = ?, gravado_em = ? WHERE id = ? AND formato = 2",
        fiscal?.nsr ?? null, fiscal?.fiscalHash ?? null, fiscal?.estabelecimentoId ?? null, fiscal?.gravadoEm ?? null, eventId,
      );
      return r.changes > 0;
    },
    async registroFiscal(eventId) {
      const l = await db.getFirstAsync("SELECT nsr_fiscal, hash_fiscal, estabelecimento_fiscal, gravado_em, enviada FROM marcacoes WHERE id = ?", eventId);
      return l && l.enviada ? { nsr: l.nsr_fiscal, fiscalHash: l.hash_fiscal, estabelecimentoId: l.estabelecimento_fiscal, gravadoEm: l.gravado_em } : null;
    },
    // Formato 1 (legado): confirmação por topo de sequência, como antes.
    async confirmarLegadoAte(seq) {
      const r = await db.runAsync("UPDATE marcacoes SET enviada = 1 WHERE enviada = 0 AND formato = 1 AND sequencia_local <= ?", seq);
      return r.changes;
    },
    async hashDaSequencia(seq) {
      const n = Number(seq);
      const base = await baseDa(db);
      if (n === base.nsr && base.nsr > 0) return base.hash;
      if (n === 0) return HASH_INICIAL;
      const l = await db.getFirstAsync("SELECT hash_local FROM marcacoes WHERE sequencia_local = ?", n);
      return l ? l.hash_local : null;
    },
    async fotosPendentes(limite) {
      return db.getAllAsync("SELECT id, caminho_foto AS caminhoFoto FROM marcacoes WHERE enviada = 1 AND foto_enviada = 0 AND caminho_foto IS NOT NULL ORDER BY sequencia_local LIMIT ?", limite);
    },
    async fotoEnviada(id) { await db.runAsync("UPDATE marcacoes SET foto_enviada = 1 WHERE id = ?", id); },
    async fotoSemArquivo(id) { await db.runAsync("UPDATE marcacoes SET foto_enviada = -1 WHERE id = ?", id); },
    async fotoRecusada(id, motivo) { await db.runAsync("UPDATE marcacoes SET foto_enviada = -2, motivo_foto = ? WHERE id = ?", String(motivo || "").slice(0, 200), id); },
    async salvarReferenciaHora(r) { await gravarEstado(db, "referencia_hora", r); },
    referenciaHora: () => lerEstado("referencia_hora"),
    async salvarCadastro(c) { await gravarEstado(db, "cadastro", c); },
    cadastro: () => lerEstado("cadastro"),
    lerEstado,
    gravarEstado: (chave, valor) => gravarEstado(db, chave, valor),
    // De qual aparelho (dispositivoId do ARCD) são os eventos deste banco.
    async dispositivoDoBanco() {
      const salvo = await lerEstado("dispositivo_id");
      if (salvo) return salvo;
      const l = await db.getFirstAsync("SELECT dados FROM marcacoes ORDER BY sequencia_local LIMIT 1");
      if (!l) return null;
      const d = JSON.parse(l.dados);
      return d.deviceId || d.dispositivoId || null;
    },
    async ultimoNsrRecebido() {
      const l = await db.getFirstAsync("SELECT MAX(nsr_fiscal) AS nsr FROM marcacoes");
      return l?.nsr ?? null;
    },
    // Últimas batidas de um funcionário neste aparelho (comprovante na tela).
    async batidasDoFuncionario(employeeId, limite = 20) {
      const linhas = await db.getAllAsync("SELECT * FROM marcacoes ORDER BY sequencia_local DESC LIMIT 500");
      return linhas.map(linhaParaEvento).filter(m => m.employeeId === employeeId).slice(0, limite);
    },
    async contagem() {
      const l = await db.getFirstAsync("SELECT SUM(enviada = 0) AS pendentes, SUM(foto_enviada = 0) AS fotos, SUM(foto_enviada < 0) AS fotosComProblema FROM marcacoes");
      return { pendentes: l?.pendentes || 0, fotos: l?.fotos || 0, fotosComProblema: l?.fotosComProblema || 0 };
    },
  };
}
