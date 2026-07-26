import { describe, expect, it } from "vitest";
import { clearPortalSessionCookie, createPortalSessionCookie, createPortalSessionToken, hashPortalPassword, hashPortalSessionToken, normalizePortalEmail, parseCookies, validPortalPassword, verifyPortalPassword } from "./client-portal-auth.js";

describe("credenciais do Portal do Cliente", () => {
  it("normaliza e valida credenciais sem guardar senha em claro", () => {
    expect(normalizePortalEmail(" Cliente@ARCD.com ")).toBe("cliente@arcd.com");
    expect(validPortalPassword("curta1")).toBe(false);
    const hash=hashPortalPassword("SenhaSegura2026");
    expect(hash).not.toContain("SenhaSegura2026");
    expect(verifyPortalPassword("SenhaSegura2026",hash)).toBe(true);
    expect(verifyPortalPassword("SenhaErrada2026",hash)).toBe(false);
  });

  it("emite token aleatório, hash persistível e cookie HttpOnly", () => {
    const token=createPortalSessionToken();
    expect(token).not.toEqual(createPortalSessionToken());
    expect(hashPortalSessionToken(token)).toHaveLength(64);
    expect(createPortalSessionCookie(token)).toContain("HttpOnly");
    expect(createPortalSessionCookie(token)).toContain("Secure");
    expect(clearPortalSessionCookie()).toContain("Max-Age=0");
    expect(parseCookies(`x=1; arcd_client_session=${token}`)).toMatchObject({x:"1",arcd_client_session:token});
  });
});
