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

  it("preserva Retry-After para a fila respeitar o limite do servidor",async()=>{
    vi.stubGlobal("fetch",vi.fn(()=>Promise.resolve({
      status:429,
      headers:{get:name=>name.toLowerCase()==="retry-after"?"8":null},
      json:()=>Promise.resolve({error:"Aguarde antes de tentar novamente."}),
    })));
    const {abrirSessao,saveDataDetailed}=await import("./api.js");
    abrirSessao("u1","123456");
    await expect(saveDataDetailed({obras:[]})).resolves.toMatchObject({
      ok:false,status:429,retryAfter:8,
      reason:"Aguarde antes de tentar novamente.",
    });
  });
});
