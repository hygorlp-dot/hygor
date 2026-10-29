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

describe("telemetria segura de erros do servidor", () => {
  it("preserva o diagnóstico técnico sem copiar a linha rejeitada pelo banco", () => {
    const error=Object.assign(new Error("violação da restrição de consistência"), {
      name:"DatabaseError", code:"23514",
      details:"Failing row contains (123.456.789-01, vetorFacial=[0.123, 0.456])",
      hint:"registro de pessoa@email.com",
      payload:{pin:"123456", documento:"123.456.789-01"},
    });
    error.stack="DatabaseError: violação da restrição de consistência\n    at gravar (api/data.js:12:3)";
    const recorded=sanitizeServerError(error);
    expect(recorded).toEqual({
      name:"DatabaseError", code:"23514", message:"violação da restrição de consistência",
      stack:"DatabaseError: violação da restrição de consistência\nat gravar (api/data.js:12:3)",
    });
    expect(JSON.stringify(recorded)).not.toMatch(/Failing row|vetorFacial|123\.456\.789-01|123456|pessoa@email/);
  });

  it("oculta credenciais e dados pessoais também na mensagem e na pilha", () => {
    const error=new Error("Falha CPF=123.456.789-01 email=pessoa@email.com pin=123456");
    error.stack="Error: Bearer token-secreto\n at consulta senha=segredo";
    const recorded=sanitizeServerError(error);
    expect(recorded.message).toContain("[CPF oculto]");
    expect(recorded.message).toContain("[e-mail oculto]");
    expect(recorded.stack).toContain("\nat consulta");
    expect(JSON.stringify(recorded)).not.toMatch(/123456|123\.456\.789-01|pessoa@email\.com|token-secreto|segredo/);
  });

  it("limita campos longos e trata exceções primitivas", () => {
    expect(sanitizeServerError({message:"x".repeat(5000),stack:"y".repeat(5000)}).message).toHaveLength(4000);
    expect(sanitizeServerError({message:"x",stack:"y".repeat(5000)}).stack).toHaveLength(4000);
    expect(sanitizeServerError("password=segredo")).toEqual({message:"password=[oculto]"});
  });
});
