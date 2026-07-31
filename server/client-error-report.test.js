import { describe, expect, it } from "vitest";
import { sanitizeClientError } from "./client-error-report";

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
