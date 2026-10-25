import { describe, expect, it, vi } from "vitest";
import { criarAdaptadorHttp } from "../scripts/homologacao/http-adapter.mjs";

const request = body => new Request("https://homologacao.test/api/data", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer token-teste" }, body: JSON.stringify(body) });
describe("adaptador da mesma API em homologação", () => {
  it.each([null, { ambiente: "producao" }, { erro: "ausente" }])("não chega ao handler sem marcador (%j)", async state => {
    const handler = vi.fn();
    const response = await criarAdaptadorHttp({ handler, confirmarAmbiente: async () => state })(request({ action: "save" }));
    expect(response.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });
  it("mismatch bloqueia qualquer escrita antes do handler", async () => {
    const handler = vi.fn();
    const response = await criarAdaptadorHttp({ handler, confirmarAmbiente: async () => ({ ambiente: "homologacao" }) })(request({ action: "operational-command", ambienteApp: "producao" }));
    expect(response.status).toBe(409);
    expect(handler).not.toHaveBeenCalled();
  });
  it("entrega credencial e ação intactas ao handler e preserva a recusa de autenticação", async () => {
    const handler = vi.fn((req, res) => res.status(401).json({ error: "Sessão inválida." }));
    const response = await criarAdaptadorHttp({ handler, confirmarAmbiente: async () => ({ ambiente: "homologacao" }) })(request({ action: "ponto-sincronizar", ambienteApp: "homologacao" }));
    expect(handler.mock.calls[0][0]).toMatchObject({ headers: { authorization: "Bearer token-teste" }, body: { action: "ponto-sincronizar" } });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sessão inválida." });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("não expõe erro interno nem executa SQL de migração", async () => {
    const handler = vi.fn(() => { throw new Error("configuracao-interna"); });
    const adapter = criarAdaptadorHttp({ handler, confirmarAmbiente: async () => ({ ambiente: "homologacao" }) });
    expect((await adapter(request({ action: "financial-shadow-migrate" }))).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const response = await adapter(request({ action: "load" }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("configuracao-interna");
  });
  it("não permite inicialização pública de operador na base isolada", async () => {
    const handler = vi.fn();
    const response = await criarAdaptadorHttp({ handler, confirmarAmbiente: async () => ({ ambiente: "homologacao" }) })(request({ action: "setup", payload: { usuarios: [{ role: "admin" }] } }));
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("informa indisponibilidade NTP sem produzir evidência falsa", async () => {
    const handler = vi.fn();
    const response = await criarAdaptadorHttp({ handler, ntpDisponivel: false, confirmarAmbiente: async () => ({ ambiente: "homologacao" }) })(request({ action: "ponto-tempo-verificar" }));
    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ ok: false, code: "NTP_INDISPONIVEL" });
    expect(handler).not.toHaveBeenCalled();
  });
});
