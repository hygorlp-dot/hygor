// Armazém do aparelho: SQLite criptografado (SQLCipher, chave aleatória
// guardada no SecureStore). MESMO contrato de src/logica/armazem-memoria.js,
// que é o que os testes exercitam.
//
// Batida nunca é alterada nem apagada aqui: só ganha "enviada"/"foto_enviada".
// A única exceção é reencadearPendentes, que renumera batidas que NUNCA
// saíram do aparelho (ver src/logica/sincronizacao.js).
import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { HASH_INICIAL } from "../../../../src/domains/ponto-eletronico/marcacao.js";

const CHAVE_BANCO = "ponto-obra.chave-banco";

async function chaveDoBanco() {
  let chave = await SecureStore.getItemAsync(CHAVE_BANCO);
  if (!chave) {
    const bytes = Crypto.getRandomBytes(32);
    chave = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(CHAVE_BANCO, chave);
  }
  return chave;
}

const linhaParaMarcacao = l => ({ ...JSON.parse(l.dados), nsr: l.nsr, hash: l.hash, hashAnterior: l.hash_anterior });

export async function abrirArmazem() {
  const db = await SQLite.openDatabaseAsync("ponto-obra.db");
  await db.execAsync(`PRAGMA key = '${await chaveDoBanco()}'`);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
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

  const lerEstado = async chave => { const l = await db.getFirstAsync("SELECT valor FROM estado WHERE chave = ?", chave); return l ? JSON.parse(l.valor) : null; };
  const gravarEstado = (alvo, chave, valor) => alvo.runAsync("INSERT INTO estado (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor", chave, JSON.stringify(valor));
  // Topo da cadeia: a maior entre a última batida local e a base alinhada com
  // o servidor (depois de um alinhamento, a base pode estar à frente das
  // batidas antigas já enviadas).
  const ultima = async alvo => {
    const l = await alvo.getFirstAsync("SELECT nsr, hash FROM marcacoes ORDER BY nsr DESC LIMIT 1");
    const l2 = await alvo.getFirstAsync("SELECT valor FROM estado WHERE chave = 'base_cadeia'");
    const base = l2 ? JSON.parse(l2.valor) : { nsr: 0, hash: HASH_INICIAL };
    return l && l.nsr > base.nsr ? { nsr: l.nsr, hash: l.hash } : base;
  };

  return {
    // Transação exclusiva: duas batidas simultâneas nunca pegam o mesmo NSR.
    async transacao(fn) {
      let resultado;
      await db.withExclusiveTransactionAsync(async txn => {
        resultado = await fn({
          ultimaMarcacao: () => ultima(txn),
          async inserirMarcacao(m) {
            const atual = await ultima(txn);
            if (m.nsr !== atual.nsr + 1) throw new Error("NSR fora de sequência no aparelho");
            const { nsr, hash, hashAnterior, ...resto } = m;
            await txn.runAsync(
              "INSERT INTO marcacoes (nsr, id, hash, hash_anterior, dados, enviada, foto_enviada) VALUES (?, ?, ?, ?, ?, 0, ?)",
              nsr, m.id, hash, hashAnterior, JSON.stringify(resto), m.fotoSha256 ? 0 : 1,
            );
          },
        });
      });
      return resultado;
    },
    ultimaMarcacaoGlobal: () => ultima(db),
    async marcacoesPendentes(limite) {
      const linhas = await db.getAllAsync("SELECT * FROM marcacoes WHERE enviada = 0 ORDER BY nsr LIMIT ?", Math.min(limite, 1_000_000));
      return linhas.map(linhaParaMarcacao);
    },
    async confirmarEnviadasAte(nsr) {
      const r = await db.runAsync("UPDATE marcacoes SET enviada = 1 WHERE enviada = 0 AND nsr <= ?", nsr);
      return r.changes;
    },
    async anexarCaminhoFoto(id, caminho) { await db.runAsync("UPDATE marcacoes SET caminho_foto = ? WHERE id = ?", caminho, id); },
    async fotosPendentes(limite) {
      return db.getAllAsync("SELECT id, caminho_foto AS caminhoFoto FROM marcacoes WHERE enviada = 1 AND foto_enviada = 0 AND caminho_foto IS NOT NULL ORDER BY nsr LIMIT ?", limite);
    },
    async fotoEnviada(id) { await db.runAsync("UPDATE marcacoes SET foto_enviada = 1 WHERE id = ?", id); },
    async salvarReferenciaHora(r) { await gravarEstado(db, "referencia_hora", r); },
    referenciaHora: () => lerEstado("referencia_hora"),
    async salvarCadastro(c) { await gravarEstado(db, "cadastro", c); },
    cadastro: () => lerEstado("cadastro"),
    async reencadearPendentes({ base, marcacoes }) {
      await db.withExclusiveTransactionAsync(async txn => {
        const extras = new Map((await txn.getAllAsync("SELECT id, caminho_foto, foto_enviada FROM marcacoes WHERE enviada = 0")).map(l => [l.id, l]));
        await txn.runAsync("DELETE FROM marcacoes WHERE enviada = 0");
        // A cadeia local passa a continuar do servidor. As renumeradas ficam
        // acima do NSR do servidor, então não colidem com as antigas enviadas.
        await gravarEstado(txn, "base_cadeia", base);
        for (const m of marcacoes) {
          const { nsr, hash, hashAnterior, ...resto } = m;
          const e = extras.get(m.id);
          await txn.runAsync(
            "INSERT INTO marcacoes (nsr, id, hash, hash_anterior, dados, enviada, foto_enviada, caminho_foto) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
            nsr, m.id, hash, hashAnterior, JSON.stringify(resto), e ? e.foto_enviada : (m.fotoSha256 ? 0 : 1), e?.caminho_foto || null,
          );
        }
      });
    },
    // Últimas batidas de um funcionário neste aparelho (comprovante na tela).
    async batidasDoFuncionario(employeeId, limite = 20) {
      const linhas = await db.getAllAsync("SELECT * FROM marcacoes ORDER BY nsr DESC LIMIT 500");
      return linhas.map(linhaParaMarcacao).filter(m => m.employeeId === employeeId).slice(0, limite);
    },
    async contagem() {
      const l = await db.getFirstAsync("SELECT SUM(enviada = 0) AS pendentes, SUM(enviada = 1 AND foto_enviada = 0) AS fotos FROM marcacoes");
      return { pendentes: l?.pendentes || 0, fotos: l?.fotos || 0 };
    },
    lerEstado, gravarEstado: (c, v) => gravarEstado(db, c, v),
  };
}
