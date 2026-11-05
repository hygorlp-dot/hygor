// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { criarServicosAssinaturaHttp } from "./servico-http.js";
import { lerConfiguracaoFiscal } from "./config.js";
import { criarTratadorPonto } from "../handler.js";

const ambiente = { NODE_ENV: "production", PONTO_FISCAL_WORKER_URL: "https://worker.example.invalid/fiscal", PONTO_FISCAL_WORKER_TOKEN: "a".repeat(40) };
describe("worker fiscal privado", () => {
  it("não conecta sem configuração e não aceita URL insegura em produção", () => {
    const fetchImpl = vi.fn();
    expect(criarServicosAssinaturaHttp({ ambiente: {}, fetchImpl })).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(() => criarServicosAssinaturaHttp({ ambiente: { ...ambiente, PONTO_FISCAL_WORKER_URL: "http://127.0.0.1:3095", PONTO_FISCAL_WORKER_LOCAL: "1" } })).toThrow("EXIGE_HTTPS");
    expect(() => criarServicosAssinaturaHttp({ ambiente: { ...ambiente, PONTO_FISCAL_WORKER_URL: "https://usuario:senha@example.invalid" } })).toThrow("EXIGE_HTTPS");
    expect(() => criarServicosAssinaturaHttp({ ambiente: { ...ambiente, PONTO_FISCAL_WORKER_TOKEN: "" } })).toThrow("SEGREDO");
  });
  it("usa segredo no header, não segue redirect e não permite URL no payload", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ base64: Buffer.from("%PDF-teste").toString("base64"), verificacao: {} })));
    const services = criarServicosAssinaturaHttp({ ambiente, fetchImpl });
    await services.assinarEValidar({ bytes: Buffer.from("%PDF-teste"), padrao: "PAdES", desenvolvedor: { tipo: "cnpj", numero: "11222333000181", nome: "Teste" } });
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url.href).toBe("https://worker.example.invalid/fiscal/assinar");
    expect(request.redirect).toBe("error"); expect(request.headers.Authorization).toBe("Bearer " + ambiente.PONTO_FISCAL_WORKER_TOKEN);
    expect(JSON.parse(request.body).desenvolvedor).toEqual({ tipo: "cnpj", numero: "11222333000181" });
    expect(url.href).not.toContain(ambiente.PONTO_FISCAL_WORKER_TOKEN);
  });
  it("falha do worker nunca vira rascunho ou vaza resposta interna", async () => {
    const services = criarServicosAssinaturaHttp({ ambiente, fetchImpl: async () => new Response("segredo interno", { status: 500 }) });
    await expect(services.renderizarPdf({ fields: [] })).rejects.toThrow("WORKER_FISCAL_REPROVOU_OPERACAO");
    const bad = criarServicosAssinaturaHttp({ ambiente, fetchImpl: async () => new Response('{"base64":"<script>"}') });
    await expect(bad.renderizarPdf({ fields: [] })).rejects.toThrow("DOCUMENTO_WORKER_INVALIDO");
  });
  it("configuração fiscal não inventa inscrição e rejeita JSON inválido", () => {
    expect(lerConfiguracaoFiscal({})).toBeNull();
    expect(() => lerConfiguracaoFiscal({ PONTO_FISCAL_CONFIG_JSON: "invalido" })).toThrow("CONFIGURACAO_FISCAL_INVALIDA");
    expect(() => lerConfiguracaoFiscal({ PONTO_FISCAL_CONFIG_JSON: "[]" })).toThrow("CONFIGURACAO_FISCAL_INVALIDA");
  });
  it("configuração fiscal inválida não é carregada na inicialização nem antes da autorização", async () => {
    const lerServicosAssinatura = vi.fn(() => { throw Error("não chamar"); });
    const handler = criarTratadorPonto({ db: {}, company: "teste", autenticarUsuario: async () => ({ role: "engenheiro" }), lerDados: async () => ({}), lerServicosAssinatura });
    expect(lerServicosAssinatura).not.toHaveBeenCalled();
    expect((await handler({ action: "ponto-fiscal", body: {} })).status).toBe(403);
    expect(lerServicosAssinatura).not.toHaveBeenCalled();
  });
});
