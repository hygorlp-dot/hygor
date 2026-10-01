// Conexão do aparelho com o ARCD (/api/data, ações ponto-*), sessão do
// aparelho (token no SecureStore) e relógio confiável.
import Constants from "expo-constants";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import RelogioConfiavel from "../../modules/relogio-confiavel";
import { horaDaMarcacao } from "../../../../src/domains/ponto-eletronico/relogio.js";

export const URL_API = Constants.expoConfig?.extra?.apiUrl || "https://pontosarcd.vercel.app/api/data";
const CHAVE_SESSAO = "ponto-obra.sessao";
const TEMPO_LIMITE_MS = 30_000;

// ---------- identificação do app e do aparelho (sem dado pessoal) ----------
// commit: injetado no build por app.config.js (EAS_BUILD_GIT_COMMIT_HASH).
export const infoDoApp = () => ({
  versao: Application.nativeApplicationVersion || Constants.expoConfig?.version || "",
  build: Application.nativeBuildVersion || "",
  commit: Constants.expoConfig?.extra?.commit || "",
});
export const infoDoAparelho = () => ({
  plataforma: "android", marca: Device.brand || Device.manufacturer || "", modelo: Device.modelName || "", android: Device.osVersion || "",
});

// ---------- sessão do aparelho ----------
export async function lerSessao() {
  const bruto = await SecureStore.getItemAsync(CHAVE_SESSAO);
  if (!bruto) return null;
  try { return JSON.parse(bruto); } catch { return null; }  // sessão corrompida = parear de novo
}
export async function salvarSessao(sessao) {
  await SecureStore.setItemAsync(CHAVE_SESSAO, JSON.stringify(sessao));
}
export async function apagarSessao() {
  await SecureStore.deleteItemAsync(CHAVE_SESSAO);
}

// ---------- API ----------
// Nunca lança: devolve { ok, status, ...json }. status 0 = sem conexão.
export function criarApi(obterToken) {
  return async function api(action, corpo = {}) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
    try {
      const token = await obterToken?.();
      const r = await fetch(URL_API, {
        method: "POST",
        signal: controle.signal,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action, ...corpo }),
      });
      const json = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, ...json };
    } catch {
      return { ok: false, status: 0, error: "Sem conexão com o ARCD. A batida fica guardada no aparelho." };
    } finally {
      clearTimeout(timer);
    }
  };
}

// ---------- relógio confiável ----------
// Se o módulo nativo falhar, a batida NÃO é impedida: usa o relógio do
// celular e sai marcada como hora não confiável.
function leitura() {
  try { return RelogioConfiavel.agora(); }
  catch { return { monotonicoMs: NaN, relogioParedeMs: Date.now(), bootId: "indisponivel" }; }
}
export function criarRelogio(armazem) {
  let referencia = null;
  return {
    async carregar() { referencia = await armazem.referenciaHora(); },
    trocarArmazem(novo) { armazem = novo; referencia = null; },
    monotonico() {
      const l = leitura();
      return { ms: l.monotonicoMs, bootId: l.bootId };
    },
    agora() {
      const l = leitura();
      return { ...horaDaMarcacao({ referencia, monotonicoMs: l.monotonicoMs, bootId: l.bootId, relogioParedeMs: l.relogioParedeMs }), relogioParedeMs: l.relogioParedeMs };
    },
  };
}
