// Núcleo SQL do armazém do aparelho - recebe um banco com a API assíncrona do
// expo-sqlite (execAsync/getFirstAsync/getAllAsync/runAsync/
// withExclusiveTransactionAsync) e não importa nada do Expo, para os testes
// rodarem o MESMO SQL contra um SQLite real no Node (armazem-sqlite.test.js).
// Contrato: src/logica/armazem-memoria.js.
//
// Batida nunca é alterada nem apagada aqui: só ganha "enviada" e o estado da
// foto. A única exceção é realinharPendentes, que renumera batidas que NUNCA
// saíram do aparelho (ver src/logica/sincronizacao.js).
//
// foto_enviada guarda o estado da foto: 0 = aguardando envio, 1 = enviada ou
// batida sem foto, -1 = arquivo não existe mais, -2 = recusada (arquivo
// preservado). Bancos antigos só tinham 0/1, que continuam valendo.
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

export async function prepararBanco(db) {
  // FULL: cada batida confirmada vai para o disco antes de o app seguir -
  // queda de energia logo depois da batida não a desfaz (com WAL + NORMAL,
  // a última transação podia ser perdida).
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS marcacoes (
      nsr INTEGER PRIMARY KEY NOT NULL,
      id TEXT NOT NULL UNIQUE,
      hash TEXT NOT NULL,
      hash_anterior TEXT NOT NULL,
      dados TEXT NOT NULL,
      enviada INTEGER NOT NULL DEFAULT 0,
      foto_enviada INTEGER NOT NULL DEFAULT 1,
      caminho_foto TEXT
    );
    CREATE TABLE IF NOT EXISTS estado (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);
  `);
  const colunas = await db.getAllAsync("PRAGMA table_info(marcacoes)");
  if (!colunas.some(c => c.name === "motivo_foto")) await db.execAsync("ALTER TABLE marcacoes ADD COLUMN motivo_foto TEXT");
}

const linhaParaMarcacao = l => ({ ...JSON.parse(l.dados), nsr: l.nsr, hash: l.hash, hashAnterior: l.hash_anterior });

export function criarArmazemSobreBanco(db) {
  const lerEstado = async chave => { const l = await db.getFirstAsync("SELECT valor FROM estado WHERE chave = ?", chave); return l ? JSON.parse(l.valor) : null; };
  const gravarEstado = (alvo, chave, valor) => alvo.runAsync("INSERT INTO estado (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor", chave, JSON.stringify(valor));
  const baseDa = async alvo => {
    const l = await alvo.getFirstAsync("SELECT valor FROM estado WHERE chave = 'base_cadeia'");
    return l ? JSON.parse(l.valor) : { nsr: 0, hash: HASH_INICIAL };
  };
  // Topo da cadeia: a maior entre a última batida local e a base alinhada com
  // o servidor (depois de um alinhamento, a base pode estar à frente das
  // batidas antigas já enviadas).
  const ultima = async alvo => {
    const l = await alvo.getFirstAsync("SELECT nsr, hash FROM marcacoes ORDER BY nsr DESC LIMIT 1");
    const base = await baseDa(alvo);
    return l && l.nsr > base.nsr ? { nsr: l.nsr, hash: l.hash } : base;
  };
  const inserir = (alvo, m, caminhoFoto, fotoEstado) => {
    const { nsr, hash, hashAnterior, ...resto } = m;
    return alvo.runAsync(
      "INSERT INTO marcacoes (nsr, id, hash, hash_anterior, dados, enviada, foto_enviada, caminho_foto) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
      nsr, m.id, hash, hashAnterior, JSON.stringify(resto), fotoEstado, caminhoFoto || null,
    );
  };

  return {
    // Transação exclusiva: duas batidas simultâneas nunca pegam o mesmo NSR.
    async transacao(fn) {
      let resultado;
      await db.withExclusiveTransactionAsync(async txn => {
        resultado = await fn({
          ultimaMarcacao: () => ultima(txn),
          async inserirMarcacao(m, { caminhoFoto = null } = {}) {
            const atual = await ultima(txn);
            if (m.nsr !== atual.nsr + 1) throw new Error("NSR fora de sequência no aparelho");
            await inserir(txn, m, caminhoFoto, m.fotoSha256 ? 0 : 1);
          },
        });
      });
      return resultado;
    },
    ultimaMarcacaoGlobal: () => ultima(db),
    async hashDoNsr(nsr) {
      const n = Number(nsr);
      const base = await baseDa(db);
      if (n === base.nsr) return base.hash;
      if (n === 0) return HASH_INICIAL;
      const l = await db.getFirstAsync("SELECT hash FROM marcacoes WHERE nsr = ?", n);
      return l ? l.hash : null;
    },
    async marcacoesPendentes(limite) {
      const linhas = await db.getAllAsync("SELECT * FROM marcacoes WHERE enviada = 0 ORDER BY nsr LIMIT ?", Math.min(limite, 1_000_000));
      return linhas.map(linhaParaMarcacao);
    },
    async confirmarEnviadasAte(nsr) {
      const r = await db.runAsync("UPDATE marcacoes SET enviada = 1 WHERE enviada = 0 AND nsr <= ?", nsr);
      return r.changes;
    },
    async fotosPendentes(limite) {
      return db.getAllAsync("SELECT id, caminho_foto AS caminhoFoto FROM marcacoes WHERE enviada = 1 AND foto_enviada = 0 AND caminho_foto IS NOT NULL ORDER BY nsr LIMIT ?", limite);
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
    // Renumera as pendentes dentro de UMA transação exclusiva: a leitura das
    // pendentes, o recálculo e a troca acontecem sem nenhuma batida nova no
    // meio (antes, uma batida feita durante o realinhamento era apagada).
    async realinharPendentes({ base, recalcular }) {
      let total = 0;
      await db.withExclusiveTransactionAsync(async txn => {
        const linhas = await txn.getAllAsync("SELECT * FROM marcacoes WHERE enviada = 0 ORDER BY nsr");
        const novas = await recalcular(linhas.map(linhaParaMarcacao));
        const ids = new Set(novas.map(n => n.id));
        if (novas.length !== linhas.length || linhas.some(l => !ids.has(l.id))) throw new Error("realinhamento perderia batidas - abortado");
        const extras = new Map(linhas.map(l => [l.id, l]));
        await txn.runAsync("DELETE FROM marcacoes WHERE enviada = 0");
        // A cadeia local passa a continuar do servidor. As renumeradas ficam
        // acima do NSR do servidor, então não colidem com as antigas enviadas.
        await gravarEstado(txn, "base_cadeia", base);
        for (const m of novas) {
          const e = extras.get(m.id);
          await inserir(txn, m, e.caminho_foto, e.foto_enviada);
        }
        total = novas.length;
      });
      return total;
    },
    // De qual aparelho (dispositivoId do ARCD) são as batidas deste banco.
    async dispositivoDoBanco() {
      const salvo = await lerEstado("dispositivo_id");
      if (salvo) return salvo;
      const l = await db.getFirstAsync("SELECT dados FROM marcacoes ORDER BY nsr LIMIT 1");
      return l ? JSON.parse(l.dados).dispositivoId || null : null;
    },
    // Últimas batidas de um funcionário neste aparelho (comprovante na tela).
    async batidasDoFuncionario(employeeId, limite = 20) {
      const linhas = await db.getAllAsync("SELECT * FROM marcacoes ORDER BY nsr DESC LIMIT 500");
      return linhas.map(linhaParaMarcacao).filter(m => m.employeeId === employeeId).slice(0, limite);
    },
    async contagem() {
      const l = await db.getFirstAsync("SELECT SUM(enviada = 0) AS pendentes, SUM(foto_enviada = 0) AS fotos, SUM(foto_enviada < 0) AS fotosComProblema FROM marcacoes");
      return { pendentes: l?.pendentes || 0, fotos: l?.fotos || 0, fotosComProblema: l?.fotosComProblema || 0 };
    },
  };
}
