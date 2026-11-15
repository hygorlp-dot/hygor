// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { criarArmazenamentoFotos } from "./fotos.js";

const caminho = "marcacoes/obra-a/2026-11-12/evento.jpg";
const bytes = Buffer.from([255, 216, 255, 1]);
const response = value => ({ json: async () => value });
const fail = status => Object.assign(new Error(`Graph ${status}`), { status });
function setup() {
  const signed = vi.fn(async () => ({ error: { message: "not found" } }));
  const from = vi.fn(() => ({ createSignedUrl: signed }));
  const ms = {
    configured: () => true,
    refresh: vi.fn(async () => ({ accessToken: "server-token" })),
    rootItem: vi.fn(async () => ({ id: "root", parentReference: { driveId: "drive" } })),
    graph: vi.fn(async (_token, _path, options) => response(options?.method === "PUT" ? { id: "photo" } : { id: "folder", folder: {} })),
  };
  const fotos = criarArmazenamentoFotos({ db: { storage: { from } }, company: "arcd", carregarGraph: async () => ms });
  return { fotos, ms, signed, from };
}
describe("fotos do ponto no OneDrive, com leitura legada", () => {
  it("envia os bytes apenas ao OneDrive central, sem cookie ou gravação no Supabase", async () => {
    const { fotos, ms, from } = setup();
    expect(await fotos.salvar(caminho, bytes)).toEqual({ caminho, provedor: "onedrive" });
    expect(ms.refresh).toHaveBeenCalledWith({ headers: {} });
    const upload = ms.graph.mock.calls.find(c => c[2]?.method === "PUT");
    expect(upload[0]).toBe("server-token");
    expect(upload[1]).toContain("evento.jpg:/content?@microsoft.graph.conflictBehavior=fail");
    expect(upload[2].body).toEqual(bytes);
    expect(from).not.toHaveBeenCalled();
  });
  it("abre a foto por URL temporária sem consultar o Storage", async () => {
    const { fotos, ms, from } = setup();
    ms.graph.mockResolvedValue(response({ "@microsoft.graph.downloadUrl": "https://onedrive.test/temporary" }));
    expect(await fotos.url(caminho)).toEqual({ url: "https://onedrive.test/temporary", provedor: "onedrive" });
    expect(from).not.toHaveBeenCalled();
  });
  it.each([404, 401, 429, 503])("preserva a foto antiga quando o Graph retorna %s", async status => {
    const { fotos, ms, signed } = setup();
    ms.graph.mockRejectedValue(fail(status));
    signed.mockResolvedValue({ data: { signedUrl: "https://supabase.test/old" } });
    expect(await fotos.url(caminho)).toMatchObject({ url: "https://supabase.test/old", provedor: "supabase" });
    expect(signed).toHaveBeenCalledWith(caminho, 300);
  });
  it("mantém fotos antigas acessíveis mesmo sem conexão Microsoft", async () => {
    const { fotos, ms, signed } = setup();
    ms.refresh.mockRejectedValue(fail(401));
    signed.mockResolvedValue({ data: { signedUrl: "https://supabase.test/old" } });
    expect((await fotos.url(caminho)).provedor).toBe("supabase");
  });
  it("indisponibilidade não confirma upload nem usa Storage como destino alternativo", async () => {
    const { fotos, ms, from } = setup();
    ms.graph.mockRejectedValue(fail(503));
    await expect(fotos.salvar(caminho, bytes)).rejects.toMatchObject({ status: 503 });
    expect(from).not.toHaveBeenCalled();
    await expect(fotos.url(caminho)).rejects.toMatchObject({ status: 503 });
  });
  it("retorna ausência apenas quando não há arquivo nas duas origens", async () => {
    const { fotos, ms } = setup();
    ms.graph.mockRejectedValue(fail(404));
    expect(await fotos.url(caminho)).toBeNull();
  });
  it.each([true, false])("reenvio nunca sobrescreve; confere bytes existentes (iguais=%s)", async iguais => {
    const { fotos, ms } = setup();
    ms.graph.mockImplementation(async (_t, path, options) => {
      if (options?.method === "PUT") throw fail(409);
      if (path.endsWith(":/content")) return { arrayBuffer: async () => iguais ? bytes : Buffer.from("diferente") };
      return response({ id: "folder", folder: {} });
    });
    if (iguais) await expect(fotos.salvar(caminho, bytes)).resolves.toMatchObject({ provedor: "onedrive" });
    else await expect(fotos.salvar(caminho, bytes)).rejects.toThrow(/conteúdo diferente/);
    expect(ms.graph.mock.calls.filter(c => c[2]?.method === "PUT")).toHaveLength(1);
  });
  it("criação concorrente de pasta usa fail e recupera a mesma pasta", async () => {
    const { fotos, ms } = setup();
    let created = false;
    ms.graph.mockImplementation(async (_t, path, options) => {
      if (path.endsWith(":/Ponto%20de%20Obra") && !created) throw fail(404);
      if (options?.method === "POST") { created = true; expect(JSON.parse(options.body)["@microsoft.graph.conflictBehavior"]).toBe("fail"); throw fail(409); }
      return response({ id: "folder", folder: {} });
    });
    await expect(fotos.salvar(caminho, bytes)).resolves.toMatchObject({ provedor: "onedrive" });
  });
  it("painel resolve fotos novas em uma sessão e sem download dos bytes", async () => {
    const { fotos, ms } = setup();
    ms.graph.mockResolvedValue(response({ "@microsoft.graph.downloadUrl": "https://onedrive.test/temporary" }));
    const caminhos = [caminho, "biometria/e1/cadastro.jpg"];
    expect((await fotos.urls(caminhos)).size).toBe(2);
    expect(ms.refresh).toHaveBeenCalledTimes(1);
    expect(ms.graph.mock.calls.every(c => !c[1].endsWith("/content"))).toBe(true);
  });
  it.each(["../arquivo", "marcacoes/../arquivo.jpg", "marcacoes/a\\b/f.jpg", "marcacoes//f.jpg"])("recusa caminho inválido %s antes da rede", async path => {
    const { fotos, ms } = setup();
    await expect(fotos.salvar(path, bytes)).rejects.toThrow(/Caminho/);
    expect(ms.refresh).not.toHaveBeenCalled();
  });
});
