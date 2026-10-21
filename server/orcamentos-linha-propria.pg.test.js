// @vitest-environment node
//
// Orçamentos em linha própria, com POSTGRES REAL (transação, FOR UPDATE e
// jsonb de verdade - o que os simuladores não provam). Roda o api/data.js de
// verdade: leitura pelo adaptador estilo supabase-js e gravação pelo driver
// `postgres` no mesmo banco.
//
// Roda na CI (job rep-p-arp-postgres, PONTO_PG_URL). Local: defina
// PONTO_PG_URL=postgres://usuario@localhost:5432/banco_descartavel.
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { camadaSupabase } from "./ponto-eletronico/banco-pglite.test-helper.js";

const URL_PG = process.env.PONTO_PG_URL;
const EMPRESA = "arcd";
const CORE = "arced_ponto_v1";
const ORC = `${CORE}__orcamentos`;

const estado = vi.hoisted(() => ({ db: null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => new Proxy({}, {
    get: (_, prop) => prop === "auth"
      ? { getUser: async () => ({ data: { user: { id: "auth-admin", email: "admin@arcd.test" } }, error: null }) }
      : estado.db[prop],
  }),
}));
// O serviço de Postgres da CI não tem TLS; em produção o api/data.js usa ssl:"require".
vi.mock("postgres", async importOriginal => {
  const real = (await importOriginal()).default;
  return { default: (url, opcoes = {}) => real(url, { ...opcoes, ssl: false }) };
});

let sql;
const linha = async key => (await sql`select value, updated_at, jsonb_typeof(value) as tipo from company_app_data where company_id=${EMPRESA} and key=${key}`)[0];
const { decodeAppData } = await import("./data-codec.js");

const aprovado = { id: "orc-v1", obraId: "obra-a", nome: "V1", versionStatus: "aprovado", itens: [{ id: "i1", precoUnit: 10 }] };
const dadosIniciais = () => ({
  usuarios: [{ id: "admin", nome: "Admin", role: "admin", email: "admin@arcd.test", authUserId: "auth-admin", active: true }],
  obras: [{ id: "obra-a", name: "Obra A" }],
  materiais: [{ id: "m1", descricao: "Cimento" }],
  orcamentos: [aprovado],
});

let handler;
const chamar = async body => {
  let status = 200, json;
  const res = { status(c) { status = c; return res; }, json(v) { json = v; return v; } };
  await handler({ body: { accessToken: "token", ...body }, query: {}, headers: { "x-forwarded-for": "127.0.0.1" } }, res);
  return { status, body: json };
};

describe.skipIf(!URL_PG)("orçamentos em linha própria (Postgres real)", () => {
  beforeAll(async () => {
    sql = postgres(URL_PG, { max: 4, onnotice: () => {} });
    await sql.unsafe(`
      create table if not exists company_app_data(company_id text, key text, value jsonb, updated_at timestamptz default now(), updated_by uuid, primary key(company_id,key));
      create table if not exists audit_events(id bigserial primary key, company_id text, aggregate_type text, aggregate_id text, action text, actor_id text,
        actor_name text, correlation_id uuid, before_snapshot jsonb, after_snapshot jsonb, source text, created_at timestamptz default now());`);
    const conexao = postgres(URL_PG, { max: 2, onnotice: () => {} });
    estado.db = camadaSupabase({ query: async (texto, params) => ({
      rows: await conexao.unsafe(texto, params.map(v => (typeof v === "string" && /^[[{]/.test(v) ? JSON.parse(v) : v))),
    }) });
    process.env.SUPABASE_URL = "https://pg.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.POSTGRES_URL_NON_POOLING = URL_PG;
    vi.resetModules();
    ({ default: handler } = await import("../api/data.js"));
  }, 60000);
  afterAll(async () => { await sql?.end({ timeout: 5 }); delete process.env.POSTGRES_URL_NON_POOLING; });
  beforeEach(async () => {
    await sql`delete from company_app_data`;
    await sql`delete from audit_events`;
    await sql`insert into company_app_data(company_id,key,value,updated_at) values (${EMPRESA},${CORE},${sql.json(dadosIniciais())},'2026-10-21T10:00:00Z')`;
  });

  const novoOrcamento = id => ({ id, obraId: "obra-a", nome: id, versionStatus: "rascunho", itens: [] });
  const salvarOrcamento = (orc, original = []) => chamar({
    action: "save-sections", sections: {}, baseSections: {},
    sectionDeltas: { orcamentos: { changed: [orc], original, removed: [] } },
    expectedUpdatedAt: "2026-10-21T10:00:00Z",
  });

  it("primeira gravação cria a linha de orçamentos, tira os orçamentos da core e mantém tudo como objeto", async () => {
    const r = await salvarOrcamento(novoOrcamento("orc-novo"));
    expect(r.status).toBe(200);
    const orc = await linha(ORC), core = await linha(CORE);
    expect(orc.tipo).toBe("object");
    expect(core.tipo).toBe("object");
    expect(decodeAppData(orc.value).orcamentos.map(o => o.id)).toEqual(["orc-v1", "orc-novo"]);
    expect(decodeAppData(orc.value).orcamentos[0]).toEqual(aprovado);
    expect(decodeAppData(core.value).orcamentos).toBeUndefined();
    expect(decodeAppData(core.value).materiais).toEqual(dadosIniciais().materiais);
    expect((await sql`select count(*)::int as n from audit_events`)[0].n).toBe(1);
  });

  it("depois disso, salvar orçamento grava só a linha de orçamentos; a core só ganha carimbo novo", async () => {
    await salvarOrcamento(novoOrcamento("orc-novo"));
    const coreAntes = await linha(CORE);
    const carregado = await chamar({ action: "load" });
    const r = await chamar({
      action: "save-sections", sections: {}, baseSections: {},
      sectionDeltas: { orcamentos: { changed: [{ ...novoOrcamento("orc-novo"), nome: "Renomeado" }], original: [novoOrcamento("orc-novo")], removed: [] } },
      expectedUpdatedAt: carregado.body.updatedAt,
    });
    expect(r.status).toBe(200);
    const coreDepois = await linha(CORE);
    expect(coreDepois.value).toEqual(coreAntes.value);
    expect(new Date(coreDepois.updated_at).getTime()).toBeGreaterThan(new Date(coreAntes.updated_at).getTime());
    expect(new Date(r.body.updatedAt).getTime()).toBe(new Date(coreDepois.updated_at).getTime());
    expect(decodeAppData((await linha(ORC)).value).orcamentos.find(o => o.id === "orc-novo").nome).toBe("Renomeado");
  });

  it("a leitura junta a linha de orçamentos com a core", async () => {
    await salvarOrcamento(novoOrcamento("orc-novo"));
    const carregado = await chamar({ action: "load" });
    expect(carregado.status).toBe(200);
    expect(carregado.body.data.orcamentos.map(o => o.id)).toEqual(["orc-v1", "orc-novo"]);
    expect(carregado.body.data.materiais).toEqual(dadosIniciais().materiais);
  });

  it("salvar outra seção grava a core e não toca na linha de orçamentos", async () => {
    await salvarOrcamento(novoOrcamento("orc-novo"));
    const orcAntes = await linha(ORC);
    const carregado = await chamar({ action: "load" });
    const r = await chamar({
      action: "save-sections", sections: {}, baseSections: {},
      sectionDeltas: { materiais: { changed: [{ id: "m2", descricao: "Areia" }], original: [], removed: [] } },
      expectedUpdatedAt: carregado.body.updatedAt,
    });
    expect(r.status).toBe(200);
    expect(decodeAppData((await linha(CORE)).value).materiais.map(m => m.id)).toEqual(["m1", "m2"]);
    const orcDepois = await linha(ORC);
    expect(orcDepois.updated_at).toEqual(orcAntes.updated_at);
  });

  it("orçamento aprovado continua imutável na linha própria", async () => {
    await salvarOrcamento(novoOrcamento("orc-novo"));
    const r = await salvarOrcamento({ ...aprovado, itens: [{ id: "i1", precoUnit: 99 }] }, [aprovado]);
    expect(r.status).toBe(409);
    expect(decodeAppData((await linha(ORC)).value).orcamentos[0]).toEqual(aprovado);
  });

  it("duas gravações simultâneas de orçamentos diferentes: nenhuma se perde", async () => {
    await salvarOrcamento(novoOrcamento("orc-novo"));
    const [a, b] = await Promise.all([salvarOrcamento(novoOrcamento("orc-a")), salvarOrcamento(novoOrcamento("orc-b"))]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const ids = decodeAppData((await linha(ORC)).value).orcamentos.map(o => o.id);
    expect(ids).toEqual(expect.arrayContaining(["orc-v1", "orc-novo", "orc-a", "orc-b"]));
  });

  it("envio completo (save) com orçamento já em linha própria é recusado em vez de perder a alteração", async () => {
    await salvarOrcamento(novoOrcamento("orc-novo"));
    const carregado = await chamar({ action: "load" });
    const r = await chamar({ action: "save", payload: { ...carregado.body.data, orcamentos: [...carregado.body.data.orcamentos, novoOrcamento("x")] }, expectedUpdatedAt: carregado.body.updatedAt });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("SECTION_IN_OWN_ROW");
  });
});
