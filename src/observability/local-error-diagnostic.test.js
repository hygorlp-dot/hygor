import { describe, expect, it } from "vitest";
import { buildLocalErrorDiagnostic, redactErrorMessage } from "./local-error-diagnostic.ts";

describe("diagnóstico local de erro", () => {
  it("remove credenciais e identificadores pessoais antes de mostrar o erro", () => {
    const message = redactErrorMessage("token=segredo-123 senha:abc CPF 123.456.789-09 e-mail obra@arcd.com.br Bearer xyz");

    expect(message).toContain("token=[oculto]");
    expect(message).toContain("senha=[oculto]");
    expect(message).toContain("[CPF oculto]");
    expect(message).toContain("[e-mail oculto]");
    expect(message).not.toContain("segredo-123");
    expect(message).not.toContain("obra@arcd.com.br");
  });

  it("gera uma referência estável sem expor a rota ou a mensagem bruta", () => {
    const diagnostic = buildLocalErrorDiagnostic(new Error("Notice is not defined"), { pathname: "/obra/h-02?token=nao-expor" });

    expect(diagnostic).toEqual({
      message: "Notice is not defined",
      reference: expect.stringMatching(/^ARCD-[A-Z0-9]+$/),
      text: expect.stringContaining("Notice is not defined"),
    });
    expect(diagnostic.text).not.toContain("h-02");
    expect(diagnostic.text).not.toContain("nao-expor");
  });
});
