import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chamarPontoEletronico } from "../../api.js";
import { INTERVALO_ATUALIZACAO_PONTO_MS, usePontoEletronico, usePontoRecurso } from "./usePontoEletronico.js";

vi.mock("../../api.js", () => ({ chamarPontoEletronico: vi.fn() }));

const HOJE = "2026-10-28";
const propsDiarios = { obraId: "obra-a", dia: HOJE, podeGerir: true, scopeKey: "usuario-a:admin" };
const respostas = {
  "ponto-dispositivos": { ok: true, dispositivos: [{ id: "aparelho-a" }] },
  "ponto-marcacoes": { ok: true, marcacoes: [{ id: "batida-a" }] },
  "ponto-biometria-status": { ok: true, biometrias: [{ employeeId: "funcionario-a" }] },
  "ponto-responsaveis": { ok: true, responsaveis: [{ userId: "responsavel-a" }] },
  "ponto-estabelecimentos": { ok: true, estabelecimentos: [{ id: "estabelecimento-a" }], repP: { rotulo: "Em teste" } },
};
const adiada = () => {
  let resolve, reject;
  const promise = new Promise((sim, nao) => { resolve = sim; reject = nao; });
  return { promise, resolve, reject };
};
const chamadas = acao => chamarPontoEletronico.mock.calls.filter(([action]) => action === acao);
const selecionarMarcacoes = resposta => resposta.marcacoes;
let root, container, atual, Harness, renders, visibilidade;

async function montar(hook, props, { strict = false } = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  renders = [];
  Harness = function HarnessDoPonto(valores) {
    atual = hook(valores);
    renders.push(atual);
    return null;
  };
  await act(async () => root.render(strict ? <React.StrictMode><Harness {...props} /></React.StrictMode> : <Harness {...props} />));
}
const renderizar = props => act(async () => root.render(<Harness {...props} />));
const concluir = (request, resposta) => act(async () => { request.resolve(resposta); });
const avancar = ms => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const mudarVisibilidade = valor => act(async () => {
  visibilidade.mockReturnValue(valor);
  document.dispatchEvent(new Event("visibilitychange"));
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${HOJE}T12:00:00.000Z`));
  chamarPontoEletronico.mockReset();
  chamarPontoEletronico.mockImplementation(async action => respostas[action]);
  visibilidade = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePontoEletronico: dados e filtros", () => {
  it("distingue carga, resultado vazio e falha por recurso, sem esperar o recurso mais lento", async () => {
    const requests = Object.fromEntries(Object.keys(respostas).map(action => [action, adiada()]));
    chamarPontoEletronico.mockImplementation(action => requests[action].promise);
    await montar(usePontoEletronico, propsDiarios);
    for (const recurso of Object.values(atual.recursos)) {
      expect(recurso).toMatchObject({ data: null, loading: true, success: false, lastUpdated: null, error: "" });
    }
    await concluir(requests["ponto-marcacoes"], { ok: true, marcacoes: [] });
    expect(atual.recursos.marcacoes).toMatchObject({ data: [], loading: false, success: true });
    expect(atual.recursos.marcacoes.lastUpdated).toBe(`${HOJE}T12:00:00.000Z`);
    expect(atual.recursos.dispositivos.loading).toBe(true);
    await concluir(requests["ponto-biometria-status"], { ok: false, error: "Biometrias indisponíveis." });
    expect(atual.recursos.biometrias).toMatchObject({ data: null, loading: false, success: false, error: "Biometrias indisponíveis." });
    expect(atual.recursos.marcacoes.success).toBe(true);
  });

  it("limpa os recursos da obra anterior e não a reapresenta quando só parte da nova consulta tem sucesso", async () => {
    await montar(usePontoEletronico, propsDiarios);
    const globais = atual.recursos.biometrias.data;
    const dispositivoB = adiada(), marcacaoB = adiada();
    chamarPontoEletronico.mockImplementation((action, payload) => {
      if (payload.obraId === "obra-b") return action === "ponto-marcacoes" ? marcacaoB.promise : dispositivoB.promise;
      return Promise.resolve(respostas[action]);
    });
    const inicioTroca = renders.length;
    await renderizar({ ...propsDiarios, obraId: "obra-b", dia: "2026-10-27" });
    expect(atual.recursos.marcacoes).toMatchObject({ data: null, success: false, lastUpdated: null });
    expect(atual.recursos.dispositivos).toMatchObject({ data: null, success: false });
    expect(renders.slice(inicioTroca).every(render => render.recursos.marcacoes.data === null)).toBe(true);
    expect(atual.recursos.biometrias.data).toBe(globais);
    await concluir(dispositivoB, { ok: true, dispositivos: [{ id: "aparelho-b" }] });
    await concluir(marcacaoB, { ok: false, error: "Sem conexão com as marcações." });
    expect(atual.recursos.dispositivos.data).toEqual([{ id: "aparelho-b" }]);
    expect(atual.recursos.marcacoes).toMatchObject({ data: null, success: false, error: "Sem conexão com as marcações." });
    for (const action of ["ponto-biometria-status", "ponto-responsaveis", "ponto-estabelecimentos"]) expect(chamadas(action)).toHaveLength(1);
  });

  it("trocar só o dia consulta apenas marcações, sem repetir aparelhos ou cadastros globais", async () => {
    await montar(usePontoEletronico, propsDiarios);
    await renderizar({ ...propsDiarios, dia: "2026-10-27" });
    expect(chamadas("ponto-marcacoes")).toHaveLength(2);
    expect(chamadas("ponto-marcacoes")[1][1]).toEqual({ obraId: "obra-a", de: "2026-10-27T03:00:00.000Z", ate: "2026-10-28T02:59:59.999Z" });
    for (const action of ["ponto-dispositivos", "ponto-biometria-status", "ponto-responsaveis", "ponto-estabelecimentos"]) expect(chamadas(action)).toHaveLength(1);
  });

  it("não consulta nem conserva responsáveis quando a permissão de gestão é retirada", async () => {
    await montar(usePontoEletronico, { ...propsDiarios, podeGerir: false });
    expect(chamadas("ponto-responsaveis")).toHaveLength(0);
    await act(async () => { await atual.refreshGlobais(); });
    expect(chamadas("ponto-responsaveis")).toHaveLength(0);
    const request = adiada();
    chamarPontoEletronico.mockImplementation(action => action === "ponto-responsaveis" ? request.promise : Promise.resolve(respostas[action]));
    await renderizar(propsDiarios);
    expect(chamadas("ponto-responsaveis")).toHaveLength(1);
    await renderizar({ ...propsDiarios, podeGerir: false });
    await concluir(request, respostas["ponto-responsaveis"]);
    expect(atual.recursos.responsaveis).toMatchObject({ data: null, success: false, loading: false });
  });

  it("trocar identidade/perfil descarta também os cadastros globais anteriores", async () => {
    await montar(usePontoEletronico, propsDiarios);
    chamarPontoEletronico.mockImplementation(() => adiada().promise);
    await renderizar({ ...propsDiarios, scopeKey: "usuario-b:financeiro", podeGerir: false });
    for (const recurso of Object.values(atual.recursos)) expect(recurso).toMatchObject({ data: null, success: false, lastUpdated: null });
    expect(chamadas("ponto-biometria-status")).toHaveLength(2);
    expect(chamadas("ponto-estabelecimentos")).toHaveLength(2);
    expect(chamadas("ponto-responsaveis")).toHaveLength(1);
  });

  it("resposta sem a lista esperada é falha, sem converter conteúdo incompleto em zero registros", async () => {
    chamarPontoEletronico.mockImplementation(async action => action === "ponto-marcacoes" ? { ok: true } : respostas[action]);
    await montar(usePontoEletronico, propsDiarios);
    expect(atual.recursos.marcacoes).toMatchObject({ data: null, success: false, loading: false });
    expect(atual.recursos.marcacoes.error).toContain("consulta incompleta");
    expect(atual.recursos.dispositivos.success).toBe(true);
  });

  it("não consulta sem obra e não envia datas civis inválidas à API", async () => {
    await montar(usePontoEletronico, { ...propsDiarios, obraId: "" });
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
    await renderizar({ ...propsDiarios, dia: "2026-02-30" });
    expect(chamadas("ponto-marcacoes")).toHaveLength(0);
    expect(atual.recursos.marcacoes).toMatchObject({ data: null, loading: false, success: false });
  });
});

describe("usePontoRecurso: concorrência e falhas", () => {
  it.each([
    { ok: true, marcacoes: [{ id: "antiga" }] },
    { ok: false, error: "Falha da consulta antiga." },
  ])("ignora resposta antiga mesmo voltando à mesma chave, resposta %#", async respostaAntiga => {
    const primeiraA = adiada(), consultaB = adiada(), segundaA = adiada();
    chamarPontoEletronico.mockReturnValueOnce(primeiraA.promise).mockReturnValueOnce(consultaB.promise).mockReturnValueOnce(segundaA.promise);
    const props = { action: "ponto-marcacoes", payload: { obraId: "a" }, select: selecionarMarcacoes };
    await montar(usePontoRecurso, props);
    await renderizar({ ...props, payload: { obraId: "b" } });
    await renderizar(props);
    await concluir(segundaA, { ok: true, marcacoes: [{ id: "nova-a" }] });
    await concluir(primeiraA, respostaAntiga);
    await concluir(consultaB, { ok: true, marcacoes: [{ id: "batida-b" }] });
    expect(atual).toMatchObject({ data: [{ id: "nova-a" }], success: true, error: "", loading: false });
  });

  it("preserva só o último sucesso da mesma chave após falha e permite tentar de novo", async () => {
    await montar(usePontoRecurso, { action: "ponto-marcacoes", select: selecionarMarcacoes });
    const instante = atual.lastUpdated;
    const request = adiada();
    chamarPontoEletronico.mockReturnValueOnce(request.promise);
    let primeira, repetida;
    await act(async () => { primeira = atual.refresh(); repetida = atual.refresh(); });
    expect(primeira).toBe(repetida);
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
    expect(atual).toMatchObject({ data: [{ id: "batida-a" }], success: true, loading: true, refreshing: true });
    await act(async () => { request.reject(new Error("Conexão interrompida.")); await primeira; });
    expect(atual).toMatchObject({ data: [{ id: "batida-a" }], success: true, loading: false, error: "Conexão interrompida.", lastUpdated: instante });
    vi.setSystemTime(new Date(`${HOJE}T12:01:00.000Z`));
    await act(async () => { await atual.refresh(); });
    expect(atual).toMatchObject({ success: true, error: "", lastUpdated: `${HOJE}T12:01:00.000Z` });
  });

  it("revalidação após mutação espera a leitura em andamento e coalesce pedidos repetidos", async () => {
    const antiga = adiada(), nova = adiada();
    chamarPontoEletronico.mockReturnValueOnce(antiga.promise).mockReturnValueOnce(nova.promise);
    await montar(usePontoRecurso, { action: "ponto-marcacoes", select: selecionarMarcacoes });
    let primeira, repetida;
    await act(async () => { primeira = atual.refresh({ revalidar: true }); repetida = atual.refresh({ revalidar: true }); });
    expect(primeira).toBe(repetida);
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(1);
    await concluir(antiga, { ok: true, marcacoes: [] });
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
    expect(atual.loading).toBe(true);
    await act(async () => { nova.resolve({ ok: true, marcacoes: [{ id: "apos-mutacao" }] }); await primeira; });
    expect(atual.data).toEqual([{ id: "apos-mutacao" }]);
  });

  it("a mesma consulta com nova identidade de objetos e ordem de campos não repete a leitura", async () => {
    const payload = Object.freeze({ de: "2026-10-01", ate: "2026-10-28" });
    const resposta = Object.freeze({ ok: true, marcacoes: Object.freeze([]), apropriacoes: Object.freeze([]), cobertura: Object.freeze({ completa: true }) });
    chamarPontoEletronico.mockResolvedValue(resposta);
    await montar(usePontoRecurso, { action: "ponto-banco-horas", payload, select: r => r, scopeKey: "usuario-a:rh" });
    await renderizar({ action: "ponto-banco-horas", payload: { ate: "2026-10-28", de: "2026-10-01" }, select: r => r, scopeKey: "usuario-a:rh" });
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(1);
    expect(atual.data).toBe(resposta);
    expect(payload).toEqual({ de: "2026-10-01", ate: "2026-10-28" });
  });

  it.each([
    { action: "ponto-codigo-pareamento", payload: { obraId: "a" } },
    { action: "ponto-marcacoes", payload: { action: "ponto-biometria-excluir", employeeId: "a" } },
  ])("recusa qualquer mutação no recurso de consulta %#", async props => {
    await montar(usePontoRecurso, { ...props, pollIntervalMs: INTERVALO_ATUALIZACAO_PONTO_MS });
    await avancar(60_000);
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
    expect(atual).toMatchObject({ success: false, data: null, loading: false });
    expect(atual.error).toContain("apenas consultas");
  });
});

describe("usePontoRecurso: polling e desmontagem", () => {
  it("agenda a próxima leitura após concluir a anterior, sem sobrepor polling e refresh manual", async () => {
    const primeira = adiada(), segunda = adiada();
    chamarPontoEletronico.mockReturnValueOnce(primeira.promise).mockReturnValueOnce(segunda.promise);
    await montar(usePontoRecurso, { action: "ponto-marcacoes", select: selecionarMarcacoes, pollIntervalMs: INTERVALO_ATUALIZACAO_PONTO_MS });
    await avancar(60_000);
    await act(async () => { atual.refresh(); });
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(1);
    await concluir(primeira, respostas["ponto-marcacoes"]);
    await avancar(INTERVALO_ATUALIZACAO_PONTO_MS - 1);
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(1);
    await avancar(1);
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
    await avancar(60_000);
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
    await concluir(segunda, respostas["ponto-marcacoes"]);
    await avancar(INTERVALO_ATUALIZACAO_PONTO_MS);
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(3);
  });

  it("pausa oculto, atualiza ao voltar e limpa timer/listener/resposta pendente ao desmontar", async () => {
    await montar(usePontoRecurso, { action: "ponto-marcacoes", select: selecionarMarcacoes, pollIntervalMs: INTERVALO_ATUALIZACAO_PONTO_MS });
    await mudarVisibilidade("hidden");
    expect(vi.getTimerCount()).toBe(0);
    await avancar(60_000);
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(1);
    await act(async () => { await atual.refresh(); });
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    const request = adiada();
    chamarPontoEletronico.mockReturnValueOnce(request.promise);
    await mudarVisibilidade("visible");
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(3);
    const remover = vi.spyOn(document, "removeEventListener");
    act(() => root.unmount());
    root = null;
    expect(remover).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    const nRenders = renders.length;
    await concluir(request, { ok: true, marcacoes: [{ id: "depois-de-sair" }] });
    await mudarVisibilidade("visible");
    await avancar(60_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(3);
    expect(renders).toHaveLength(nRenders);
  });

  it("não atualiza histórico nem cadastros globais no polling de aparelhos", async () => {
    await montar(usePontoEletronico, { ...propsDiarios, dia: "2026-10-27" });
    await avancar(INTERVALO_ATUALIZACAO_PONTO_MS);
    expect(chamadas("ponto-dispositivos")).toHaveLength(2);
    expect(chamadas("ponto-marcacoes")).toHaveLength(1);
    for (const action of ["ponto-biometria-status", "ponto-responsaveis", "ponto-estabelecimentos"]) expect(chamadas(action)).toHaveLength(1);
    await renderizar(propsDiarios);
    await avancar(INTERVALO_ATUALIZACAO_PONTO_MS);
    expect(chamadas("ponto-marcacoes")).toHaveLength(3);
    expect(chamadas("ponto-dispositivos")).toHaveLength(3);
  });

  it("o replay de efeitos do StrictMode não inicia leituras abandonadas", async () => {
    await montar(usePontoRecurso, { action: "ponto-marcacoes", select: selecionarMarcacoes }, { strict: true });
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(1);
    expect(atual).toMatchObject({ success: true, loading: false, data: [{ id: "batida-a" }] });
  });
});
