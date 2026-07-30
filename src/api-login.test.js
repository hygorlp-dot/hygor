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

  it("transforma falha de rede de rota auxiliar em resposta controlada",async()=>{
    vi.stubGlobal("fetch",vi.fn(()=>Promise.reject(new TypeError("offline"))));
    const {abrirSessao,chamarIA}=await import("./api.js");
    abrirSessao("u1","123456");
    await expect(chamarIA({prompt:"teste"})).resolves.toEqual({
      ok:false,status:0,error:"Não foi possível conectar ao servidor.",
    });
  });

  it("renova a sessão antes do heartbeat e evita o 401 da presença",async()=>{
    const fetchMock=vi.fn(async(url,options={})=>{
      const body=JSON.parse(options.body||"{}");
      if(url==="/api/data"&&body.action==="auth-login")return {
        status:200,ok:true,json:async()=>({
          data:{obras:[]},usuario:{id:"u1",nome:"QA"},
          accessToken:"token-expirado",refreshToken:"refresh-1",
        }),
      };
      if(url==="/api/data"&&body.action==="auth-refresh")return {
        status:200,ok:true,json:async()=>({
          accessToken:"token-renovado",refreshToken:"refresh-2",
        }),
      };
      if(url==="/api/presence")return {
        status:200,ok:true,json:async()=>({ok:true,lastSeen:"2026-07-30T17:00:00.000Z"}),
      };
      throw new Error(`Rota inesperada: ${url}`);
    });
    vi.stubGlobal("fetch",fetchMock);
    const {entrarComEmail,registrarPresenca}=await import("./api.js");

    await entrarComEmail("qa@arcd.test","senha");
    await expect(registrarPresenca("ponto")).resolves.toMatchObject({ok:true});

    const actions=fetchMock.mock.calls.map(([,options])=>JSON.parse(options.body).action);
    expect(actions).toEqual(["auth-login","auth-refresh","heartbeat"]);
    const heartbeat=JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(heartbeat.accessToken).toBe("token-renovado");
  });

  it("suspende heartbeats repetidos depois de uma sessão rejeitada",async()=>{
    const fetchMock=vi.fn(async()=>({
      status:401,ok:false,json:async()=>({error:"Sessão inválida."}),
    }));
    vi.stubGlobal("fetch",fetchMock);
    const {abrirSessao,registrarPresenca}=await import("./api.js");
    abrirSessao("u1","123456");

    await expect(registrarPresenca("ponto")).resolves.toMatchObject({ok:false,status:401});
    await expect(registrarPresenca("ponto")).resolves.toMatchObject({
      ok:false,status:401,suspended:true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
