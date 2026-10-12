// Adaptadores do livro de migrations: a mesma lógica (livro.mjs) roda em
// Postgres real (postgres.js) e no PGlite dos testes.
//
// postgres.js: use UMA conexão fixa (sql.reserve() ou max: 1) - a trava de
// sessão (pg_advisory_lock) e o BEGIN/COMMIT precisam da mesma conexão.
export function adaptadorPostgres(conexao) {
  return {
    query: (texto, params = []) => conexao.unsafe(texto, params),
    exec: texto => conexao.unsafe(texto),
    async transacao(fn) {
      await conexao.unsafe("begin");
      try { const r = await fn(); await conexao.unsafe("commit"); return r; } catch (e) { await conexao.unsafe("rollback").catch(() => {}); throw e; }
    },
  };
}

export function adaptadorPglite(db) {
  return {
    query: async (texto, params = []) => (await db.query(texto, params)).rows,
    exec: texto => db.exec(texto),
    async transacao(fn) {
      await db.exec("begin");
      try { const r = await fn(); await db.exec("commit"); return r; } catch (e) { await db.exec("rollback").catch(() => {}); throw e; }
    },
  };
}
