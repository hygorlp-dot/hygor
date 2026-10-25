// @vitest-environment node
import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { criarAdaptadorHttp } from "../scripts/homologacao/http-adapter.mjs";
import { criarRoteadorHomologacao } from "../scripts/homologacao/route-handlers.mjs";

const request = (path, body = {}) => new Request(`https://homologacao.test${path}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const montar = (environment = "homologacao") => {
  const handlers = Object.fromEntries(["data", "upload", "presence", "dailyBrief"].map(name => [name,
    vi.fn((req, res) => req.body?.accessToken === "sessao-teste" ? res.status(200).json({ route: name }) : res.status(401).json({ error: "Sessão inválida." })),
  ]));
  return { handlers, serve: criarAdaptadorHttp({ handler: criarRoteadorHomologacao(handlers), confirmarAmbiente: async () => ({ ambiente: environment }) }) };
};

describe("rotas auxiliares do app na homologação", () => {
  it("publica presença e resumo diário no mesmo backend isolado", () => {
    const config = JSON.parse(fs.readFileSync(new URL("../apps/homologacao/vercel.json", import.meta.url), "utf8"));
    for (const route of ["presence", "ai-agent"]) {
      expect(config.rewrites).toContainEqual({
        source: `/api/${route}`,
        destination: `https://ukkzpttnbyylkyujzwnv.supabase.co/functions/v1/ponto-api-homologacao/${route}`,
      });
    }
  });

  it.each(["/api", "/ponto-api-homologacao", "/functions/v1/ponto-api-homologacao"])("preserva autenticação e credenciais nos handlers originais: %s", async prefix => {
    const { handlers, serve } = montar();
    for (const [route, action] of [["presence", "heartbeat"], ["ai-agent", "daily-brief"]]) {
      expect((await serve(request(`${prefix}/${route}`, { action }))).status).toBe(401);
      const response = await serve(request(`${prefix}/${route}`, { action, accessToken: "sessao-teste" }));
      expect(response.status).toBe(200);
    }
    expect(handlers.presence.mock.calls[1][0].body.accessToken).toBe("sessao-teste");
    expect(handlers.dailyBrief.mock.calls[1][0].body.accessToken).toBe("sessao-teste");
  });

  it.each([undefined, "chat", "status", "configure", "remove", "budget-match", ["daily-brief"], "daily-brief "])("IA externa fica bloqueada antes de carregar o handler: %j", async action => {
    const { handlers, serve } = montar();
    const response = await serve(request("/api/ai-agent?action=daily-brief", { action, accessToken: "sessao-teste" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "AI_DISABLED_HOMOLOGACAO" });
    expect(handlers.dailyBrief).not.toHaveBeenCalled();
  });

  it("marcador inválido e ambiente incompatível bloqueiam também presença e resumo", async () => {
    for (const route of ["presence", "ai-agent"]) {
      const invalid = montar("producao");
      expect((await invalid.serve(request(`/api/${route}`, { action: "daily-brief" }))).status).toBe(503);
      expect(invalid.handlers.presence).not.toHaveBeenCalled();
      expect(invalid.handlers.dailyBrief).not.toHaveBeenCalled();
      const valid = montar();
      expect((await valid.serve(request(`/api/${route}`, { ambienteApp: "producao", action: "daily-brief" }))).status).toBe(409);
      expect(valid.handlers.presence).not.toHaveBeenCalled();
      expect(valid.handlers.dailyBrief).not.toHaveBeenCalled();
    }
  });

  it("caminho desconhecido não cai na API de dados ou de IA", async () => {
    const { handlers, serve } = montar();
    expect((await serve(request("/functions/v1/ponto-api-homologacao/outro/ai-agent", { action: "daily-brief" }))).status).toBe(404);
    for (const fn of Object.values(handlers)) expect(fn).not.toHaveBeenCalled();
  });
});
