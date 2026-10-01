// Postgres REAL em memória (PGlite) com as migrations 016 + 017 aplicadas e
// uma camada com o mesmo jeito do supabase-js que o servidor usa
// (from().select().eq()... / rpc / storage). Os testes ponta a ponta do app e
// da ARP rodam o SQL de verdade - função ponto_arp_registrar, travas,
// constraints e triggers incluídos.
//
// O banco base é montado uma vez por processo e clonado (dumpDataDir) para
// cada teste: rápido e isolado.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const lerMigration = nome => fs.readFileSync(path.join(raiz, "migrations", nome), "utf8");
export const PAPEIS_SUPABASE = `do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;`;

let base = null;
async function montarBase() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(PAPEIS_SUPABASE);
  await db.exec(lerMigration("016_create_ponto_eletronico.up.sql"));
  await db.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));
  const dump = await db.dumpDataDir();
  await db.close();
  return dump;
}

export async function novoPglite() {
  base ??= montarBase();
  return new PGlite({ loadDataDir: await base, extensions: { pgcrypto } });
}

// Valor JS -> parâmetro SQL (objeto/array vira jsonb, como o PostgREST faz).
const ehJson = v => v !== null && typeof v === "object" && !(v instanceof Date);
// Linha do PGlite -> como o PostgREST devolveria (datas em texto ISO).
const comoPostgrest = linha => Object.fromEntries(Object.entries(linha).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));
const ident = c => `"${String(c).replace(/"/g, "")}"`;

export function camadaSupabase(pg) {
  const arquivos = new Map();
  const consulta = tabela => {
    const filtros = [], params = [];
    let modo = "select", colunas = "*", ordem = [], limite = null, patch = null, novos = null, conflito = null, retornar = false;
    const p = valor => { params.push(ehJson(valor) ? JSON.stringify(valor) : valor); return `$${params.length}${ehJson(valor) ? "::jsonb" : ""}`; };
    const onde = () => (filtros.length ? ` where ${filtros.join(" and ")}` : "");
    const executar = async () => {
      let sql;
      if (modo === "select") {
        sql = `select ${colunas === "*" ? "*" : colunas.split(",").map(c => ident(c.trim())).join(",")} from public.${ident(tabela)}${onde()}`;
        if (ordem.length) sql += ` order by ${ordem.join(", ")}`;
        if (limite) sql += ` limit ${Number(limite)}`;
      } else if (modo === "insert" || modo === "upsert") {
        const linhas = [].concat(novos);
        const cols = [...new Set(linhas.flatMap(Object.keys))];
        const valores = linhas.map(l => `(${cols.map(c => (l[c] === undefined ? "default" : p(l[c]))).join(",")})`).join(",");
        sql = `insert into public.${ident(tabela)} (${cols.map(ident).join(",")}) values ${valores}`;
        if (modo === "upsert") {
          const alvo = conflito.split(",").map(c => c.trim());
          sql += ` on conflict (${alvo.map(ident).join(",")}) do update set ${cols.filter(c => !alvo.includes(c)).map(c => `${ident(c)} = excluded.${ident(c)}`).join(",")}`;
        }
        if (retornar) sql += " returning *";
      } else if (modo === "update") {
        const sets = Object.entries(patch).map(([c, v]) => `${ident(c)} = ${p(v)}`).join(",");
        sql = `update public.${ident(tabela)} set ${sets}${onde()}${retornar ? " returning *" : ""}`;
      } else {
        sql = `delete from public.${ident(tabela)}${onde()}`;
      }
      try {
        const r = await pg.query(sql, params);
        return { data: modo === "select" || retornar ? r.rows.map(comoPostgrest) : null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    };
    const b = {
      select(c = "*") { if (modo !== "select") retornar = true; else colunas = c; return b; },
      eq(k, v) { filtros.push(`${ident(k)} = ${p(v)}`); return b; },
      gte(k, v) { filtros.push(`${ident(k)} >= ${p(v)}`); return b; },
      lte(k, v) { filtros.push(`${ident(k)} <= ${p(v)}`); return b; },
      is(k, v) { filtros.push(`${ident(k)} is ${v === null ? "null" : v ? "true" : "false"}`); return b; },
      in(k, lista) { filtros.push(lista.length ? `${ident(k)} in (${lista.map(p).join(",")})` : "false"); return b; },
      order(k, o = {}) { ordem.push(`${ident(k)} ${o.ascending === false ? "desc" : "asc"}`); return b; },
      limit(n) { limite = n; return b; },
      insert(r) { modo = "insert"; novos = r; return b; },
      update(x) { modo = "update"; patch = x; return b; },
      upsert(r, o) { modo = "upsert"; novos = r; conflito = o.onConflict; return b; },
      delete() { modo = "delete"; return b; },
      async maybeSingle() { const r = await executar(); return { data: r.data?.[0] ?? null, error: r.error }; },
      then(ok, falha) { return executar().then(ok, falha); },
    };
    return b;
  };
  return {
    pg, arquivos,
    from: consulta,
    async rpc(nome, args) {
      const nomes = Object.keys(args);
      const valores = nomes.map(n => (ehJson(args[n]) ? JSON.stringify(args[n]) : args[n]));
      const sql = `select * from public.${ident(nome)}(${nomes.map((n, i) => `${n} => $${i + 1}${ehJson(args[n]) ? "::jsonb" : ""}`).join(", ")})`;
      try { return { data: (await pg.query(sql, valores)).rows.map(comoPostgrest), error: null }; }
      catch (error) { return { data: null, error }; }
    },
    storage: { from: () => ({
      async upload(caminho, buffer) { if (arquivos.has(caminho)) return { error: { message: "The resource already exists" } }; arquivos.set(caminho, buffer); return { error: null }; },
      async createSignedUrl(caminho) { return arquivos.has(caminho) ? { data: { signedUrl: `https://assinado/${caminho}` }, error: null } : { data: null, error: { message: "not found" } }; },
      async remove(caminhos) { caminhos.forEach(c => arquivos.delete(c)); return { error: null }; },
    }) },
  };
}
