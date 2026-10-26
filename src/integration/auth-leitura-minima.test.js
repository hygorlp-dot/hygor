import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// /api/data autentica lendo SÓ a linha core (onde moram os `usuarios`). As
// linhas auxiliares (domínios separados e Ponto por obra) só são consultadas
// depois que a sessão é aceita, então chamadas sem sessão válida deixam de
// baixar e decodificar o resto do dataset.

const estado = vi.hoisted(() => ({
  consultas: { nucleo: 0, separadas: 0, pontoObra: 0 },
  usuarioDoToken: "auth-admin",
  emailDoToken: "admin@arcd.test",
}));

const queryFor = () => {
  let modo = "";
  let chave = "";
  const query = {
    select() { return query; },
    eq(campo, valor) { if (campo === "key") chave = valor; return query; },
    upsert: async () => ({ error: null }),
    in() { modo = "separadas"; return query; },
    like() { modo = "pontoObra"; return query; },
    order() { return query; },
    maybeSingle: async () => {
      // O índice de perfis (outra chave) também é lido via maybeSingle.
      if (chave !== "arced_ponto_v1") return { data: null, error: null };
      estado.consultas.nucleo++;
      return {
        data: {
          value: {
            usuarios: [{ id: "admin-a", nome: "Admin", role: "admin", authUserId: "auth-admin", email: "admin@arcd.test", active: true }],
            obras: [], employees: [],
          },
          updated_at: "2026-10-26T12:00:00.000Z",
        },
        error: null,
      };
    },
    then(resolve, reject) {
      estado.consultas[modo === "pontoObra" ? "pontoObra" : "separadas"]++;
      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    },
  };
  return query;
};

const bancoFalso = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(async token => token === "token-valido"
      ? { data: { user: { id: estado.usuarioDoToken, email: estado.emailDoToken } }, error: null }
      : { data: null, error: { message: "invalid" } }),
  },
  from: vi.fn(() => queryFor()),
  rpc: vi.fn(async () => ({ data: null, error: null })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => bancoFalso }));

let handler;
const chamar = async body => {
  let status = 200, corpo;
  const cabecalhos = {};
  const res = { headersSent: false, setHeader(k, v) { cabecalhos[k] = v; }, status(codigo) { status = codigo; return res; }, json(valor) { corpo = valor; return valor; } };
  await handler({ body, query: {}, headers: { "x-forwarded-for": "127.0.0.1" } }, res);
  return { status, corpo, cabecalhos };
};

describe("/api/data · autenticação lê só a linha core", () => {
  beforeAll(async () => {
    process.env.SUPABASE_URL = "https://leitura-minima.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    delete process.env.POSTGRES_URL_NON_POOLING;
    vi.resetModules();
    ({ default: handler } = await import("../../api/data.js"));
  }, 30000);
  afterAll(() => { vi.resetModules(); });
  beforeEach(() => { Object.assign(estado.consultas, { nucleo: 0, separadas: 0, pontoObra: 0 }); });

  it("token inválido responde 401 sem consultar as linhas auxiliares", async () => {
    const resposta = await chamar({ action: "load", accessToken: "token-ruim" });
    expect(resposta.status).toBe(401);
    expect(estado.consultas).toEqual({ nucleo: 1, separadas: 0, pontoObra: 0 });
  });

  it("até a resposta 401 informa o tempo das fases já percorridas", async () => {
    const resposta = await chamar({ action: "load", accessToken: "token-ruim" });
    expect(resposta.cabecalhos["Server-Timing"]).toMatch(/^auth;dur=\d+\.\d, acao;dur=\d+\.\d, total;dur=\d+\.\d$/);
  });

  it("PIN de usuário inexistente responde 401 sem consultar as linhas auxiliares", async () => {
    const resposta = await chamar({ action: "load", userId: "ninguem", pin: "0000" });
    expect(resposta.status).toBe(401);
    expect(estado.consultas).toEqual({ nucleo: 1, separadas: 0, pontoObra: 0 });
  });

  it("token válido sem vínculo com operador ativo também não baixa o resto", async () => {
    estado.usuarioDoToken = "auth-desconhecido";
    estado.emailDoToken = "outra-pessoa@arcd.test";
    try {
      const resposta = await chamar({ action: "load", accessToken: "token-valido" });
      expect(resposta.status).toBe(401);
      expect(estado.consultas).toEqual({ nucleo: 1, separadas: 0, pontoObra: 0 });
    } finally { estado.usuarioDoToken = "auth-admin"; estado.emailDoToken = "admin@arcd.test"; }
  });

  it("sessão válida lê a core uma única vez e completa com as linhas auxiliares", async () => {
    const resposta = await chamar({ action: "load", accessToken: "token-valido" });
    expect(resposta.status).toBe(200);
    expect(resposta.corpo.usuario.id).toBe("admin-a");
    expect(resposta.corpo.updatedAt).toBe("2026-10-26T12:00:00.000Z");
    expect(estado.consultas).toEqual({ nucleo: 1, separadas: 1, pontoObra: 1 });
  });
});

