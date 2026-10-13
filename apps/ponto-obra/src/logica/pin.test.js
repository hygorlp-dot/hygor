// @vitest-environment node
//
// Sessão do modo encarregado: o PIN digitado fica só em memória (closure) para
// o servidor conferir no cadastro facial (PONTO_EXIGIR_PIN_NO_SERVIDOR=1).
import { describe, expect, it } from "vitest";
import { abrirSessaoResponsavel, corpoCadastroBiometria } from "./pin.js";

const PIN = "90817263";   // sintético
const RESP = { userId: "u-enc", nome: "Encarregado" };

describe("sessão do responsável com o PIN em memória", () => {
  it("o PIN não é propriedade do objeto: não aparece em JSON, spread, chaves nem String()", () => {
    const sessao = abrirSessaoResponsavel(RESP, PIN);
    expect(sessao.userId).toBe("u-enc");
    expect(sessao.nome).toBe("Encarregado");
    expect(JSON.stringify(sessao)).not.toContain(PIN);
    expect(JSON.stringify({ ...sessao })).not.toContain(PIN);
    expect(Object.values(sessao).filter(v => typeof v !== "function")).toEqual(["u-enc", "Encarregado"]);
    expect(String(sessao)).not.toContain(PIN);
    expect(Object.isFrozen(sessao)).toBe(true);
    expect(sessao.pinParaServidor()).toBe(PIN);
  });

  it("o corpo do cadastro facial leva responsavelId e pinResponsavel, sem mexer nos outros campos", () => {
    const sessao = abrirSessaoResponsavel(RESP, PIN);
    const campos = { employeeId: "e1", vetor: [1, 2], consentimento: { termoVersao: "2026-10" } };
    expect(corpoCadastroBiometria(sessao, campos)).toEqual({ ...campos, responsavelId: "u-enc", pinResponsavel: PIN });
    expect(campos).not.toHaveProperty("pinResponsavel");
  });

  it("descartar() apaga o PIN: o corpo sai sem pinResponsavel (servidor com o flag recusa)", () => {
    const sessao = abrirSessaoResponsavel(RESP, PIN);
    sessao.descartar();
    expect(sessao.pinParaServidor()).toBeNull();
    expect(corpoCadastroBiometria(sessao, { employeeId: "e1" })).toEqual({ employeeId: "e1", responsavelId: "u-enc" });
    sessao.descartar();   // idempotente
    expect(sessao.pinParaServidor()).toBeNull();
  });

  it("guarda só os dígitos, como a conferência offline", () => {
    expect(abrirSessaoResponsavel(RESP, " 90-81 7263 ").pinParaServidor()).toBe(PIN);
    expect(abrirSessaoResponsavel(RESP, undefined).pinParaServidor()).toBeNull();
  });
});
