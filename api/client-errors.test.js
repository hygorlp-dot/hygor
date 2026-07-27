import { describe, expect, it, vi } from "vitest";
import handler from "./client-errors";

const response = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader: vi.fn((key, value) => { res.headers[key] = value; }),
    status: vi.fn(code => { res.statusCode = code; return res; }),
    json: vi.fn(body => { res.body = body; return res; }),
  };
  return res;
};

describe("telemetria segura de erros do cliente", () => {
  it("aceita somente campos técnicos e oculta credenciais", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = response();
    handler({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.22" },
      body: {
        reference: "ARCD-5HQ4L9",
        message: "Falha password=segredo em pessoa@email.com",
        pathname: "/",
        errorStack: "at Tela (LegacyApp.jsx:1:2)",
        componentStack: "at Tela",
        extra: "não deve entrar",
      },
    }, res);

    expect(res.statusCode).toBe(202);
    const recorded = spy.mock.calls[0][1];
    expect(recorded).toContain("ARCD-5HQ4L9");
    expect(recorded).not.toContain("segredo");
    expect(recorded).not.toContain("pessoa@email.com");
    expect(recorded).not.toContain("não deve entrar");
    spy.mockRestore();
  });

  it("recusa método de leitura", () => {
    const res = response();
    handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("POST");
  });
});
