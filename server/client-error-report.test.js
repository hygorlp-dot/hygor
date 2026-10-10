import { describe, expect, it } from "vitest";
import { sanitizeClientError, sanitizeServerError } from "./client-error-report";

describe("telemetria segura de erros do cliente", () => {
  it("aceita somente campos técnicos e oculta credenciais", () => {
    const recorded = sanitizeClientError({
      reference: "ARCD-5HQ4L9",
      message: "Falha password=segredo em pessoa@email.com",
      pathname: "/",
      errorStack: "at Tela (LegacyApp.jsx:1:2)",
      componentStack: "at Tela",
      extra: "não deve entrar",
    });

    expect(recorded.reference).toBe("ARCD-5HQ4L9");
    expect(JSON.stringify(recorded)).not.toContain("segredo");
    expect(JSON.stringify(recorded)).not.toContain("pessoa@email.com");
    expect(recorded).not.toHaveProperty("extra");
  });
});

describe("log seguro de erro do servidor", () => {
  it("erro do PostgREST não leva a linha que falhou (CPF, vetor facial) para o log", () => {
    const erro = Object.assign(new Error('new row for relation "ponto_biometrias" violates check constraint "ponto_biometrias_qualidade"'), {
      code: "23514",
      details: "Failing row contains (arcd, 7d6c3f6e, e1, mobilefacenet, {0.0123,-0.0456,0.0789}, 123.456.789-09).",
      hint: "valores: 12345678909",
    });
    const log = sanitizeServerError(erro);
    const texto = JSON.stringify(log);
    expect(log).toMatchObject({ name: "Error", code: "23514" });
    expect(log.message).toContain("violates check constraint");
    expect(log.stack).toMatch(/client-error-report.test/);
    for (const proibido of ["Failing row", "0.0123", "123.456.789-09", "12345678909", "details", "hint"]) expect(texto).not.toContain(proibido);
  });

  it("mensagem com CPF ou token também é ocultada; valor que não é objeto vira só mensagem", () => {
    expect(sanitizeServerError(new Error("cpf 123.456.789-09 Bearer abcdefghijklmnop")).message).toBe("cpf [CPF oculto] Bearer [oculto]");
    expect(sanitizeServerError("falhou")).toEqual({ message: "falhou" });
  });
});
