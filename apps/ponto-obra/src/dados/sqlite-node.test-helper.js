// SQLite REAL no Node (node:sqlite) com a API assíncrona do expo-sqlite, para
// os testes rodarem o MESMO SQL do aparelho (armazem-sqlite-nucleo.js) num
// arquivo de verdade - fechar e reabrir é fechar e reabrir o arquivo.
// Sem withExclusiveTransactionAsync próprio: a transação vem de
// serializarBanco, exatamente como no aparelho (onde a do expo-sqlite abriria
// conexão sem a chave do SQLCipher).
import { DatabaseSync } from "node:sqlite";
import { criarArmazemSobreBanco, prepararBanco, serializarBanco } from "./armazem-sqlite-nucleo.js";

export function abrirNode(arquivo) {
  const banco = new DatabaseSync(arquivo);
  return serializarBanco({
    async execAsync(sql) { banco.exec(sql); },
    async getFirstAsync(sql, ...p) { return banco.prepare(sql).get(...p) ?? null; },
    async getAllAsync(sql, ...p) { return banco.prepare(sql).all(...p); },
    async runAsync(sql, ...p) { const r = banco.prepare(sql).run(...p); return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }; },
    async closeAsync() { banco.close(); },
  });
}

// Abre como o app abre: prepara (migração local incluída) e cria o armazém.
export async function abrirArmazemNode(arquivo) {
  const db = abrirNode(arquivo);
  await prepararBanco(db);
  return { db, armazem: criarArmazemSobreBanco(db) };
}

// Banco como as versões ANTERIORES do app deixavam (formato 1: "nsr" por
// aparelho), com as batidas dadas - para testar a atualização do app.
export function criarBancoFormato1(arquivo, marcacoes) {
  const banco = new DatabaseSync(arquivo);
  banco.exec(`CREATE TABLE marcacoes (nsr INTEGER PRIMARY KEY NOT NULL, id TEXT NOT NULL UNIQUE, hash TEXT NOT NULL, hash_anterior TEXT NOT NULL,
    dados TEXT NOT NULL, enviada INTEGER NOT NULL DEFAULT 0, foto_enviada INTEGER NOT NULL DEFAULT 1, caminho_foto TEXT);
    CREATE TABLE estado (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);`);
  const ins = banco.prepare("INSERT INTO marcacoes (nsr, id, hash, hash_anterior, dados, enviada, foto_enviada) VALUES (?, ?, ?, ?, ?, ?, 1)");
  for (const m of marcacoes) {
    const { nsr, hash, hashAnterior, enviada = false, ...resto } = m;
    ins.run(nsr, m.id, hash, hashAnterior, JSON.stringify(resto), enviada ? 1 : 0);
  }
  banco.close();
}
