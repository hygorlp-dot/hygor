import { beforeEach, describe, expect, it, vi } from "vitest";

const response = body => Promise.resolve({
  status:200,
  ok:true,
  json:() => Promise.resolve(body),
});

describe("contrato de resposta do login", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("não inicia sessão nem lança exceção com HTTP 200 malformado", async () => {
    vi.stubGlobal("fetch",vi.fn(() => response({ok:true})));
    const {entrarComEmail,temSessao}=await import("./api.js");
    await expect(entrarComEmail("qa@arcd.test","senha")).resolves.toEqual({
      ok:false,
      erro:"O servidor devolveu uma resposta de autenticação inválida. Tente novamente.",
    });
    expect(temSessao()).toBe(false);
  });

  it("aceita somente a resposta completa e guarda a sessão válida", async () => {
    vi.stubGlobal("fetch",vi.fn(() => response({
      data:{obras:[]},
      usuario:{id:"u1",nome:"QA"},
      accessToken:"token",
      refreshToken:"refresh",
    })));
    const {entrarComEmail,temSessao}=await import("./api.js");
    await expect(entrarComEmail("qa@arcd.test","senha")).resolves.toMatchObject({
      ok:true,
      data:{obras:[]},
      usuario:{id:"u1"},
    });
    expect(temSessao()).toBe(true);
  });
});
