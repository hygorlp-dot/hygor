// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import ambiente from "../../config/ambiente.js";
import { criarArmazemMemoria } from "./armazem-memoria.js";
import { rodadaDeSincronizacao, sincronizarCadastro } from "./sincronizacao.js";

const { resolverServidor, conferirAmbiente, decidirAmbienteDoPareamento, sessaoConfereCom } = ambiente;
const URL_HOMOLOG = "https://ponto-homologacao.vercel.app/api/data";

describe("servidor embutido no APK", () => {
  it("exige escolha explícita de ambiente e endereço de homologação", () => {
    expect(() => resolverServidor({ urlPadrao: "https://pontosarcd.vercel.app/api/data" })).toThrow(/obrigatório/);
    expect(() => resolverServidor({ ambiente: "homologacao", urlPadrao: "https://pontosarcd.vercel.app/api/data" })).toThrow(/exige PONTO_API_URL/);
    expect(resolverServidor({ ambiente: "homologacao", urlEnv: URL_HOMOLOG })).toEqual({ ambiente: "homologacao", apiUrl: URL_HOMOLOG });
  });

  it.each([
    "https://pontosarcd.vercel.app/api/data",
    "https://pontos-git-homolog-equipe.vercel.app/api/data",
    "https://mrc-homolog-123.vercel.app/api/data",
    "https://127.0.0.1/api/data",
    "https://homologacao.example.com./api/data",
    "http://homologacao.example.com/api/data",
    "https://homologacao.example.com/api/data?token=123",
    "https://usuario:senha@homologacao.example.com/api/data",
    "https://homologacao.example.com/api/data#fragmento",
    "https://homologacao.example.com:8080/api/data",
    "https://homologacao.example.com/outro",
  ])("recusa destino incompatível: %s", urlEnv => {
    expect(() => resolverServidor({ ambiente: "homologacao", urlEnv })).toThrow();
  });

  it("produção explícita mantém o endereço existente e recusa homologação", () => {
    const urlPadrao = "https://pontosarcd.vercel.app/api/data";
    expect(resolverServidor({ ambiente: "producao", urlPadrao }).apiUrl).toBe(urlPadrao);
    expect(() => resolverServidor({ ambiente: "producao", urlEnv: URL_HOMOLOG, urlPadrao })).toThrow();
  });
});

describe("confirmação antes de parear e vínculo guardado", () => {
  it("homologação exige confirmação positiva; servidor legado só vale para produção", () => {
    expect(conferirAmbiente("homologacao", "homologacao").ok).toBe(true);
    expect(conferirAmbiente("homologacao", undefined).ok).toBe(false);
    expect(conferirAmbiente("", "homologacao").ok).toBe(false);
    expect(decidirAmbienteDoPareamento({ ok: false, status: 400 }, "producao").ok).toBe(true);
    expect(decidirAmbienteDoPareamento({ ok: false, status: 400 }, "homologacao").ok).toBe(false);
    expect(decidirAmbienteDoPareamento({ ok: false, status: 503, ambiente: "homologacao" }, "homologacao").ok).toBe(false);
    expect(decidirAmbienteDoPareamento({ ok: false, status: 0 }, "homologacao").ok).toBe(false);
  });

  it("sessão de homologação não migra para outro ambiente ou servidor", () => {
    const sessao = { ambiente: "homologacao", servidor: "ponto-homologacao.vercel.app" };
    expect(sessaoConfereCom(sessao, "homologacao", sessao.servidor)).toBe(true);
    expect(sessaoConfereCom(sessao, "homologacao", "outra-homologacao.vercel.app")).toBe(false);
    expect(sessaoConfereCom(sessao, "producao", sessao.servidor)).toBe(false);
    expect(sessaoConfereCom({}, "homologacao", sessao.servidor)).toBe(false);
    expect(sessaoConfereCom({}, "producao", "pontosarcd.vercel.app")).toBe(true);
  });
});

describe("fila preservada quando o ambiente não confere", () => {
  const monotonico = () => ({ ms: 1000, bootId: "boot-homologacao" });
  it.each([undefined, "producao"])("não grava catálogo, hora nem envia fila se servidor responde %s", async servidor => {
    const armazem = criarArmazemMemoria();
    const cadastro = { funcionarios: [{ id: "piloto-k110-fulano" }, { id: "piloto-k110-siclano" }] };
    await armazem.salvarCadastro(cadastro);
    const api = vi.fn(async () => ({ ok: true, status: 200, ambiente: servidor, servidorMs: Date.parse("2026-10-25T12:00:00Z") }));
    const fila = vi.spyOn(armazem, "eventosPendentes");
    const fotos = vi.spyOn(armazem, "fotosPendentes");
    const r = await rodadaDeSincronizacao({ armazem, api, monotonico, cadastroVencido: true, ambienteApp: "homologacao" });
    expect(r.ambienteIncompativel).toBe(true);
    expect(api).toHaveBeenCalledTimes(1);
    expect(fila).not.toHaveBeenCalled();
    expect(fotos).not.toHaveBeenCalled();
    expect(await armazem.cadastro()).toEqual(cadastro);
    expect(await armazem.referenciaHora()).toBeNull();
  });

  it("atualiza os dois trabalhadores quando o servidor confirma homologação", async () => {
    const armazem = criarArmazemMemoria();
    const funcionarios = [{ id: "piloto-k110-fulano" }, { id: "piloto-k110-siclano" }];
    const api = async () => ({ ok: true, status: 200, ambiente: "homologacao", funcionarios, servidorMs: Date.parse("2026-10-25T12:00:00Z") });
    expect((await sincronizarCadastro({ armazem, api, monotonico, ambienteApp: "homologacao" })).ok).toBe(true);
    expect((await armazem.cadastro()).funcionarios).toEqual(funcionarios);
  });

  it("confere o ambiente mesmo com catálogo recente", async () => {
    const armazem = criarArmazemMemoria();
    const api = vi.fn(async () => ({ ok: false, status: 503, code: "AMBIENTE_NAO_CONFIRMADO", error: "Ambiente não confirmado" }));
    const r = await rodadaDeSincronizacao({ armazem, api, monotonico, cadastroVencido: false, ambienteApp: "homologacao" });
    expect(r.ambienteIncompativel).toBe(true);
    expect(api).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[0][0]).toBe("ponto-sincronizar");
  });
});
