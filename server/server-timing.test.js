import { describe, expect, it, vi } from "vitest";
import { anexarCronometro, criarCronometro } from "./server-timing.js";

const relogioFalso = (...instantes) => { const fila = [...instantes]; return () => fila.shift(); };

describe("cronômetro Server-Timing", () => {
  it("registra o tempo desde a marca anterior e o total", () => {
    const c = criarCronometro(relogioFalso(0, 10, 40, 100));
    c.marcar("auth");
    c.marcar("leitura");
    expect(c.cabecalho()).toBe("auth;dur=10.0, leitura;dur=30.0, total;dur=100.0");
  });

  it("normaliza nomes de fase para o formato aceito pelo cabeçalho", () => {
    const c = criarCronometro(relogioFalso(0, 5, 5));
    c.marcar("leitura do banco");
    expect(c.cabecalho()).toBe("leitura_do_banco;dur=5.0, total;dur=5.0");
  });

  it("injeta o cabeçalho ao enviar o JSON, fechando a fase acao, e preserva o corpo", () => {
    const enviados = [];
    const res = { headersSent: false, setHeader: vi.fn(), json: corpo => { enviados.push(corpo); return "ok"; } };
    anexarCronometro(res, criarCronometro(relogioFalso(0, 20, 50)));
    expect(res.json({ a: 1 })).toBe("ok");
    expect(enviados).toEqual([{ a: 1 }]);
    expect(res.setHeader).toHaveBeenCalledWith("Server-Timing", "acao;dur=20.0, total;dur=50.0");
  });

  it("não define o cabeçalho depois que a resposta já saiu", () => {
    const res = { headersSent: true, setHeader: vi.fn(), json: () => {} };
    anexarCronometro(res, criarCronometro());
    res.json({});
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("uma falha ao medir nunca impede a resposta", () => {
    const enviados = [];
    const res = { setHeader() { throw new Error("falhou"); }, json: corpo => enviados.push(corpo) };
    anexarCronometro(res, criarCronometro());
    expect(() => res.json({ ok: true })).not.toThrow();
    expect(enviados).toEqual([{ ok: true }]);
  });

  it("não faz nada com res simulado sem setHeader", () => {
    const json = vi.fn();
    const res = { json };
    anexarCronometro(res, criarCronometro());
    expect(res.json).toBe(json);
  });
});
