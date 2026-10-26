// Conexão do aparelho com o MARCELL (/api/data, ações ponto-*), sessão do
// aparelho (token no SecureStore) e relógio confiável.
import Constants from "expo-constants";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import RelogioConfiavel from "../../modules/relogio-confiavel";
import { horaDaMarcacao } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { AMBIENTES, NOME_AMBIENTE, resolverServidor, sessaoConfereCom } from "../../config/ambiente";
import {criarTransporte} from './transporte.js';

const EXTRA = Constants.expoConfig?.extra || {};
export const AMBIENTE = AMBIENTES.includes(EXTRA.ambiente) ? EXTRA.ambiente : "";
export const URL_API = (() => {
  if (!EXTRA.apiUrl) return null;
  try { return resolverServidor({ ambiente: AMBIENTE, urlEnv: EXTRA.apiUrl }).apiUrl; }
  catch { return null; }
})();
export const infoDoServidor = () => ({
  host: URL_API ? new URL(URL_API).host : "",
  ambiente: AMBIENTE, nomeAmbiente: NOME_AMBIENTE[AMBIENTE] || "SEM CONFIGURAÇÃO", bloqueado: !URL_API,
});
const CHAVE_SESSAO = "ponto-obra.sessao";

// ---------- identificação do app e do aparelho (sem dado pessoal) ----------
// commit: injetado no build por app.config.js (EAS_BUILD_GIT_COMMIT_HASH).
export const infoDoApp = () => ({
  versao: Application.nativeApplicationVersion || Constants.expoConfig?.version || "",
  build: Application.nativeBuildVersion || "",
  commit: Constants.expoConfig?.extra?.commit || "",
  perfil: Constants.expoConfig?.extra?.buildPerfil || "",
  buildId: Constants.expoConfig?.extra?.buildId || "",
  buildEm: Constants.expoConfig?.extra?.buildEm || "",
  ambiente: AMBIENTE,
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
  await SecureStore.setItemAsync(CHAVE_SESSAO, JSON.stringify({ ...sessao, ambiente: AMBIENTE, servidor: infoDoServidor().host }));
}
export const sessaoConfere = sessao => sessaoConfereCom(sessao, AMBIENTE, infoDoServidor().host);
export async function apagarSessao() {
  await SecureStore.deleteItemAsync(CHAVE_SESSAO);
}

// ---------- API ----------
// Nunca lança: devolve { ok, status, ...json }. status 0 = sem conexão.
export function criarApi(obterToken) {
  return criarTransporte({url:URL_API,ambiente:AMBIENTE,obterToken});
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
