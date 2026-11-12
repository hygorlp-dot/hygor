// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { assinarFotosEquipe } from "./fotos-assinadas.js";

function cenario() {
  let tempo = 1000;
  let versao = 0;
  const assinar = vi.fn(async caminhos => ({ data: caminhos.map(path => ({ path, signedUrl: `${path}?token=${++versao}` })) }));
  const from = vi.fn(() => ({ createSignedUrls: assinar }));
  const db = { storage: { from } };
  const consultar = (caminhos = ["a.jpg"], company = "empresa-a") => assinarFotosEquipe({ db, company, caminhos, agora: () => tempo });
  return { assinar, from, consultar, avancar: ms => { tempo += ms; } };
}

describe("URLs privadas de fotos da equipe", () => {
  it("reutiliza URL por 90s, renova com 30s de margem e mantém validade de 120s", async () => {
    const c = cenario();
    const primeira = await c.consultar();
    for (let i = 0; i < 4; i++) { c.avancar(20_000); expect(await c.consultar()).toEqual(primeira); }
    expect(c.assinar).toHaveBeenCalledTimes(1);
    expect(c.assinar).toHaveBeenCalledWith(["a.jpg"], 120);
    expect(c.from).toHaveBeenCalledWith("ponto-obra");
    c.avancar(10_000);
    expect(await c.consultar()).not.toEqual(primeira);
    expect(c.assinar).toHaveBeenCalledTimes(2);
  });
  it("não retorna caminhos omitidos pelo filtro atual nem compartilha entre empresas ou clientes", async () => {
    const c = cenario();
    await c.consultar(["a.jpg", "b.jpg"]);
    expect([...await c.consultar(["b.jpg"])]).toHaveLength(1);
    expect((await c.consultar([])).size).toBe(0);
    await c.consultar(["a.jpg"], "empresa-b");
    expect(c.assinar).toHaveBeenCalledTimes(2);
    const outro = cenario(); await outro.consultar();
    expect(outro.assinar).toHaveBeenCalledTimes(1);
  });
  it("mudança de caminho renova foto imediatamente", async () => {
    const c = cenario(); await c.consultar();
    const r = await c.consultar(["nova.jpg"]);
    expect(r.has("a.jpg")).toBe(false);
    expect(r.has("nova.jpg")).toBe(true);
    expect(c.assinar).toHaveBeenCalledTimes(2);
  });
  it.each(["erro", "excecao", "parcial"])("desacelera falha %s por 60s e depois recupera", async tipo => {
    const c = cenario();
    if (tipo === "excecao") c.assinar.mockRejectedValueOnce(new Error("rede"));
    else c.assinar.mockResolvedValueOnce(tipo === "erro" ? { error: { status: 402 } } : { data: [{ path: "a.jpg", error: "not found" }] });
    expect((await c.consultar()).size).toBe(0);
    c.avancar(59_999); expect((await c.consultar()).size).toBe(0);
    expect(c.assinar).toHaveBeenCalledTimes(1);
    c.avancar(1); expect((await c.consultar()).has("a.jpg")).toBe(true);
    expect(c.assinar).toHaveBeenCalledTimes(2);
  });
  it("não devolve URL com margem vencida por uma resposta lenta", async () => {
    const c = cenario();
    c.assinar.mockImplementationOnce(async () => { c.avancar(90_000); return { data: [{ path: "a.jpg", signedUrl: "lenta" }] }; });
    expect((await c.consultar()).size).toBe(0);
  });
  it("deduplica caminhos, limita lotes a 100 e ignora resultados não pedidos", async () => {
    const c = cenario();
    const caminhos = Array.from({ length: 205 }, (_, i) => `${i}.jpg`);
    const r = await c.consultar([...caminhos, caminhos[0]]);
    expect(r.size).toBe(205);
    expect(c.assinar.mock.calls.map(([lista]) => lista.length)).toEqual([100, 100, 5]);
    c.assinar.mockResolvedValueOnce({ data: [{ path: "alheia.jpg", signedUrl: "fora" }] });
    expect((await c.consultar(["nova.jpg"])).size).toBe(0);
  });
  it("limita memória a 1000 entradas", async () => {
    const c = cenario();
    await c.consultar(Array.from({ length: 1001 }, (_, i) => `${i}.jpg`));
    const chamadas = c.assinar.mock.calls.length;
    await c.consultar(["1000.jpg"]); expect(c.assinar).toHaveBeenCalledTimes(chamadas);
    await c.consultar(["0.jpg"]); expect(c.assinar).toHaveBeenCalledTimes(chamadas + 1);
  });
  it("não retorna URL de lote anterior cuja margem venceu durante outro lote", async () => {
    const c = cenario();
    c.assinar.mockImplementationOnce(async caminhos => ({ data: caminhos.map(path => ({ path, signedUrl: path })) }));
    c.assinar.mockImplementationOnce(async caminhos => {
      c.avancar(90_000);
      return { data: caminhos.map(path => ({ path, signedUrl: path })) };
    });
    expect((await c.consultar(Array.from({ length: 101 }, (_, i) => `${i}.jpg`))).size).toBe(0);
  });
});
