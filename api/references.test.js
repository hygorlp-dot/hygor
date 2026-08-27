import { beforeEach, describe, expect, it, vi } from "vitest";

// api/references.js lê SUPABASE_URL/SERVICE_ROLE_KEY e chama createClient()
// no carregamento do módulo - precisam existir ANTES do import.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.COMPANY_ID = "arcd";

vi.mock("./auth.js", () => ({
  authenticateAppUser: vi.fn().mockResolvedValue({ id: "user-1", role: "admin" }),
}));

// Mock encadeável mínimo do client do Supabase: cada .from(tabela) devolve a
// próxima resposta enfileirada para aquela tabela (ou {data:null,error:null}
// se a fila estiver vazia), e registra toda chamada de filtro para inspeção.
function createSupabaseMock(filas = {}) {
  const chamadas = [];
  const from = vi.fn(tabela => {
    const fila = filas[tabela] || [];
    const resultado = fila.shift() || { data: null, error: null };
    const builder = {};
    const encadeavel = metodo => vi.fn((...args) => { chamadas.push([tabela, metodo, ...args]); return builder; });
    ["select", "eq", "in", "order", "neq", "is", "ilike"].forEach(metodo => { builder[metodo] = encadeavel(metodo); });
    builder.limit = vi.fn((...args) => { chamadas.push([tabela, "limit", ...args]); return Promise.resolve(resultado); });
    builder.maybeSingle = vi.fn(() => Promise.resolve(resultado));
    builder.single = vi.fn(() => Promise.resolve(resultado));
    builder.insert = vi.fn(row => { chamadas.push([tabela, "insert", row]); return builder; });
    builder.update = vi.fn(row => { chamadas.push([tabela, "update", row]); return builder; });
    builder.upsert = vi.fn((rows, opts) => { chamadas.push([tabela, "upsert", rows, opts]); return Promise.resolve(resultado); });
    builder.delete = vi.fn(() => { chamadas.push([tabela, "delete"]); return Promise.resolve(resultado); });
    builder.then = resolve => resolve(resultado);
    return builder;
  });
  return { from, chamadas };
}

function reqRes(body) {
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
  return { req: { method: "POST", body }, res };
}

describe("/api/references - ORSE reaproveita o pipeline do SINAPI", () => {
  let handler, supabaseMock;

  beforeEach(async () => {
    vi.resetModules();
    supabaseMock = createSupabaseMock();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: () => supabaseMock }));
    ({ default: handler } = await import("./references.js"));
  });

  it("begin: cadastra uma base ORSE nova como uploaded/processing (não mais official/ready)", async () => {
    supabaseMock.chamadas.length = 0;
    supabaseMock.from.mockImplementationOnce(() => {
      const builder = {};
      ["select", "eq", "is"].forEach(m => { builder[m] = vi.fn(() => builder); });
      builder.order = vi.fn(() => builder);
      builder.limit = vi.fn(() => builder);
      builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null })); // nenhuma base existente
      return builder;
    });
    supabaseMock.from.mockImplementationOnce(() => {
      const builder = {};
      builder.select = vi.fn(() => builder);
      builder.single = vi.fn(() => Promise.resolve({
        data: { id: "base-orse-1", source: "ORSE", competence: "2026-06", uf: null, desonerado: null, mode: "uploaded", status: "processing", item_count: 0 },
        error: null,
      }));
      builder.insert = vi.fn(row => { supabaseMock.chamadas.push(["budget_reference_bases", "insert", row]); return builder; });
      return builder;
    });

    const { req, res } = reqRes({ action: "begin", userId: "user-1", pin: "0000", meta: { fonte: "ORSE", dataBase: "2026-06" } });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const insertCall = supabaseMock.chamadas.find(c => c[1] === "insert");
    expect(insertCall[2]).toMatchObject({ source: "ORSE", mode: "uploaded", status: "processing" });
    expect(res.body.base.modo).toBe("uploaded");
  });

  it("chunk: aceita uma base ORSE (antes só SINAPI) e grava com source dinâmico", async () => {
    supabaseMock.from.mockImplementationOnce(() => {
      const builder = {};
      ["select", "eq"].forEach(m => { builder[m] = vi.fn(() => builder); });
      builder.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: "base-orse-1", source: "ORSE" }, error: null }));
      return builder;
    });
    supabaseMock.from.mockImplementationOnce(() => {
      const builder = {};
      builder.upsert = vi.fn((rows, opts) => { supabaseMock.chamadas.push(["budget_reference_items", "upsert", rows, opts]); return Promise.resolve({ data: null, error: null }); });
      return builder;
    });

    const { req, res } = reqRes({
      action: "chunk", userId: "user-1", pin: "0000", baseId: "base-orse-1",
      items: [{ codigo: "4", descricao: "Limpeza mecanizada", unidade: "m2", precoDes: 6.74, precoNao: 6.74 }],
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const upsertCall = supabaseMock.chamadas.find(c => c[1] === "upsert");
    expect(upsertCall[2][0]).toMatchObject({ source: "ORSE", code: "4" });
  });

  it("resolve: uma base ORSE já importada (mode uploaded) é resolvida via Postgres, sem raspar a web", async () => {
    global.fetch = vi.fn(() => { throw new Error("não deveria raspar a web para uma base já importada"); });

    supabaseMock.from.mockImplementationOnce(() => {
      const builder = {};
      ["select", "in"].forEach(m => { builder[m] = vi.fn(() => builder); });
      builder.eq = vi.fn(() => builder);
      builder.then = resolve => resolve({
        data: [{ id: "base-orse-1", source: "ORSE", mode: "uploaded", status: "ready", competence: "2026-06", uf: null }],
        error: null,
      });
      return builder;
    });
    supabaseMock.from.mockImplementationOnce(() => {
      const builder = {};
      ["select", "eq", "in"].forEach(m => { builder[m] = vi.fn(() => builder); });
      builder.limit = vi.fn(() => Promise.resolve({
        data: [{ base_id: "base-orse-1", source: "ORSE", code: "4", description: "Limpeza mecanizada", unit: "m2", price_des: 6.74, price_not: 6.74, detail_url: null }],
        error: null,
      }));
      return builder;
    });

    const { req, res } = reqRes({
      action: "resolve", userId: "user-1", pin: "0000",
      referenceIds: ["base-orse-1"], entries: [{ codigo: "4", fonte: "ORSE" }],
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toEqual([expect.objectContaining({ fonte: "ORSE", codigo: "4", precoDes: 6.74 })]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
