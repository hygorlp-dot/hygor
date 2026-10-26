import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// save-sections trava a core e a linha de orçamentos (FOR UPDATE). A leitura
// sem lock do topo do handler já decodificou essas linhas, então o lock pede
// só o carimbo e reaproveita a fatia quando ele é EXATAMENTE o lido. Se outra
// gravação passou entre a leitura e o lock, o valor novo é baixado na mesma
// transação e a mesclagem de três vias o preserva.
const CORE = "arced_ponto_v1";
const ORC = `${CORE}__orcamentos`;
const T0 = "2026-10-26T12:00:00.123456+00:00";
const T_CONCORRENTE = "2026-10-26T12:00:05.654321+00:00";

const estado = vi.hoisted(() => ({ rows: {}, sql: [], aoLerSemLock: null, seq: 0 }));

const pgTexto = iso => iso.replace("T", " ").replace("+00:00", "+00");
const proximoCarimbo = () => `2026-10-26T12:01:${String(10 + (++estado.seq)).padStart(2, "0")}.000001+00:00`;

const queryFor = () => {
  let modo = "";
  let chave = "";
  const query = {
    select() { return query; },
    eq(campo, valor) { if (campo === "key") chave = valor; return query; },
    in() { modo = "separadas"; return query; },
    like() { modo = "pontoObra"; return query; },
    order() { return query; },
    update() { return query; },
    upsert: async () => ({ error: null }),
    maybeSingle: async () => {
      const linha = estado.rows[chave];
      return { data: linha ? { value: linha.value, updated_at: linha.updated_at } : null, error: null };
    },
    then(resolve, reject) {
      const dados = modo === "separadas"
        ? Object.values(estado.rows).filter(l => l.key !== CORE && !l.key.includes("__ponto__obra__"))
          .map(l => ({ key: l.key, value: l.value, updated_at: l.updated_at }))
        : [];
      const resposta = { data: JSON.parse(JSON.stringify(dados)), error: null };
      if (modo === "separadas" && estado.aoLerSemLock) { const gancho = estado.aoLerSemLock; estado.aoLerSemLock = null; gancho(); }
      return Promise.resolve(resposta).then(resolve, reject);
    },
  };
  return query;
};

const bancoFalso = vi.hoisted(() => ({
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: "auth-admin", email: "admin@arcd.test" } }, error: null })) },
  from: vi.fn(() => queryFor()),
  rpc: vi.fn(async () => ({ data: null, error: null })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => bancoFalso }));

// Fiel ao driver: FOR UPDATE devolve updated_at como Date (só milissegundos) e
// o carimbo exato em texto; o valor só vem num SELECT à parte.
const PG_JSON = Symbol("pg-json");
const jsonb = v => (v && typeof v === "object" && PG_JSON in v ? v[PG_JSON] : v);
const transacao = () => Object.assign(async (strings, ...valores) => {
  const sql = strings.join("?").replace(/\s+/g, " ").trim();
  estado.sql.push(sql);
  if (sql.includes("for update")) {
    const linha = estado.rows[valores[1]];
    return linha ? [{ updated_at: new Date(linha.updated_at), carimbo_exato: pgTexto(linha.updated_at) }] : [];
  }
  if (sql.startsWith("select value from company_app_data")) return [{ value: estado.rows[valores[1]].value }];
  if (sql.startsWith("insert into company_app_data")) {
    const [, key, valor] = valores;
    estado.rows[key] = { ...(estado.rows[key] || {}), key, company_id: "arcd", value: jsonb(valor), updated_at: proximoCarimbo() };
    return [];
  }
  if (sql.startsWith("update company_app_data set updated_at=clock_timestamp()")) {
    const linha = estado.rows[valores[1]];
    linha.updated_at = proximoCarimbo();
    return [{ updated_at: new Date(linha.updated_at) }];
  }
  if (sql.startsWith("insert into audit_events")) return [];
  throw new Error(`Query inesperada: ${sql.slice(0, 90)}`);
}, { json: valor => ({ [PG_JSON]: valor }) });

vi.mock("postgres", () => ({
  default: vi.fn(() => ({ begin: async trabalho => trabalho(transacao()), end: async () => {} })),
}));

let handler;
const chamar = async body => {
  let status = 200, json;
  const cabecalhos = {};
  const res = { headersSent: false, setHeader(k, v) { cabecalhos[k] = v; }, status(c) { status = c; return res; }, json(v) { json = v; return v; } };
  await handler({ body: { accessToken: "token", ...body }, query: {}, headers: { "x-forwarded-for": "127.0.0.1" } }, res);
  return { status, body: json, cabecalhos };
};

const orc = (id, nome = id) => ({ id, obraId: "obra-a", nome, versionStatus: "rascunho", itens: [] });
const idsDeOrcamentos = () => estado.rows[ORC].value.orcamentos.map(o => o.id);
const buscasDeValor = () => estado.sql.filter(s => s.startsWith("select value from company_app_data"));

describe("/api/data save-sections · reaproveita as linhas já lidas dentro da transação", () => {
  beforeAll(async () => {
    process.env.SUPABASE_URL = "https://sem-reler.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    process.env.POSTGRES_URL_NON_POOLING = "postgres://user:pass@localhost:5432/app";
    vi.resetModules();
    ({ default: handler } = await import("../../api/data.js"));
  }, 30000);
  afterAll(() => { delete process.env.POSTGRES_URL_NON_POOLING; vi.resetModules(); });

  beforeEach(() => {
    estado.sql.length = 0; estado.aoLerSemLock = null; estado.seq = 0;
    estado.rows = {
      [CORE]: { key: CORE, company_id: "arcd", updated_at: T0, value: {
        usuarios: [{ id: "admin", nome: "Admin", role: "admin", email: "admin@arcd.test", authUserId: "auth-admin", active: true }],
        obras: [{ id: "obra-a", name: "Obra A" }],
      } },
      [ORC]: { key: ORC, company_id: "arcd", updated_at: T0, value: { orcamentos: [orc("orc-a")] } },
    };
  });

  const salvar = novo => chamar({
    action: "save-sections", sections: {}, baseSections: {},
    sectionDeltas: { orcamentos: { changed: [novo], original: [], removed: [] } },
    expectedUpdatedAt: T0,
  });

  it("com as linhas inalteradas, trava só pelo carimbo e não baixa o valor de novo", async () => {
    const r = await salvar(orc("orc-c"));
    expect(r.status).toBe(200);
    expect(buscasDeValor()).toEqual([]);
    expect(estado.sql.filter(s => s.includes("for update"))).toHaveLength(2); // core + orçamentos
    expect(idsDeOrcamentos()).toEqual(["orc-a", "orc-c"]);
  });

  it("devolve o tempo de cada fase do salvamento em Server-Timing", async () => {
    const r = await salvar(orc("orc-c"));
    const fases = r.cabecalhos["Server-Timing"].split(", ").map(p => p.split(";")[0]);
    expect(fases).toEqual(["auth", "leitura", "conexao", "locks", "validacao", "gravacao", "commit", "acao", "total"]);
    r.cabecalhos["Server-Timing"].split(", ").forEach(p => expect(p).toMatch(/^[a-z]+;dur=\d+\.\d$/));
  });

  it("trava a core antes da linha de orçamentos e seleciona só o carimbo", async () => {
    await salvar(orc("orc-c"));
    const locks = estado.sql.filter(s => s.includes("for update"));
    locks.forEach(s => expect(s.startsWith("select updated_at,updated_at::text as carimbo_exato")).toBe(true));
  });

  it("se outra gravação alterou os orçamentos entre a leitura e o lock, baixa o valor novo e preserva ambas as mudanças", async () => {
    estado.aoLerSemLock = () => {
      estado.rows[ORC] = { ...estado.rows[ORC], updated_at: T_CONCORRENTE, value: { orcamentos: [orc("orc-a"), orc("orc-b")] } };
    };
    const r = await salvar(orc("orc-c"));
    expect(r.status).toBe(200);
    expect(buscasDeValor()).toHaveLength(1); // só a linha que mudou
    expect(idsDeOrcamentos().sort()).toEqual(["orc-a", "orc-b", "orc-c"]);
  });

  it("diferença só de microssegundos também força a releitura", async () => {
    estado.aoLerSemLock = () => {
      estado.rows[ORC] = { ...estado.rows[ORC], updated_at: "2026-10-26T12:00:00.123457+00:00", value: { orcamentos: [orc("orc-a"), orc("orc-b")] } };
    };
    const r = await salvar(orc("orc-c"));
    expect(r.status).toBe(200);
    expect(buscasDeValor()).toHaveLength(1);
    expect(idsDeOrcamentos().sort()).toEqual(["orc-a", "orc-b", "orc-c"]);
  });
});
