import { useCallback, useEffect, useRef, useState } from "react";
import { chamarPontoEletronico } from "../../api.js";
import { dataLocal, intervaloDoDia } from "./painel.js";

export const INTERVALO_ATUALIZACAO_PONTO_MS = 20_000;

// O hook só consulta. Mutações continuam explícitas na tela e nunca entram
// no polling, nem por um `action` incluído acidentalmente no payload.
const ACOES_DE_LEITURA = new Set([
  "ponto-dispositivos", "ponto-marcacoes", "ponto-biometria-status",
  "ponto-responsaveis", "ponto-estabelecimentos", "ponto-apropriacoes", "ponto-banco-horas",
]);
const selecionarResposta = resposta => resposta;
const estaVisivel = () => typeof document === "undefined" || document.visibilityState === "visible";
const serializar = valor => JSON.stringify(valor, (_chave, item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  return Object.fromEntries(Object.keys(item).sort().map(chave => [chave, item[chave]]));
});
const estadoInicial = (key, enabled) => ({
  key, data: null, loading: enabled, success: false, error: "", lastUpdated: null,
});

/**
 * Leitura isolada por ação, payload, identidade/perfil e habilitação. Não há
 * cache compartilhado entre telas/sessões. `select` só transforma a resposta;
 * dependências adicionais da seleção devem participar de `queryKey`.
 *
 * `success` significa que existe uma leitura bem-sucedida DESTA chave. Ela
 * permanece disponível durante uma atualização ou falha posterior, junto de
 * `lastUpdated` e `error`. Antes do primeiro sucesso, `data` continua null.
 * `refresh({ revalidar: true })` garante uma leitura após a que já está em
 * curso; chamadas repetidas enfileiram no máximo uma nova leitura.
 */
export function usePontoRecurso({
  action, payload = {}, select = selecionarResposta, scopeKey = "", queryKey = "",
  enabled = true, pollIntervalMs = 0,
}) {
  const payloadKey = serializar(payload || {});
  const key = serializar([scopeKey, action, payloadKey, queryKey, !!enabled]);
  const [snapshot, setSnapshot] = useState(() => estadoInicial(key, !!enabled));
  const consultaAtual = useRef(null);

  useEffect(() => {
    let ativa = true;
    let timer = null;
    let pendente = null;
    let proxima = null;
    const parametros = JSON.parse(payloadKey);
    const leituraPermitida = ACOES_DE_LEITURA.has(action)
      && !Object.prototype.hasOwnProperty.call(parametros, "action");

    const atualizar = transformacao => {
      if (!ativa) return;
      setSnapshot(anterior => {
        if (!ativa) return anterior;
        return transformacao(anterior.key === key ? anterior : estadoInicial(key, !!enabled));
      });
    };
    const pararTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const agendar = () => {
      pararTimer();
      if (!ativa || !enabled || !leituraPermitida || pollIntervalMs <= 0 || !estaVisivel()) return;
      timer = window.setTimeout(() => {
        timer = null;
        if (estaVisivel()) executar();
      }, pollIntervalMs);
    };
    const executar = ({ revalidar = false } = {}) => {
      if (!ativa || !enabled) return Promise.resolve(null);
      if (pendente) {
        if (!revalidar) return pendente;
        if (!proxima) proxima = pendente.then(() => {
          proxima = null;
          return executar();
        });
        return proxima;
      }
      pararTimer();
      atualizar(anterior => ({ ...anterior, loading: true, error: "" }));
      pendente = Promise.resolve().then(async () => {
        if (!ativa) return null;
        if (!leituraPermitida) throw new Error("Este recurso aceita apenas consultas de ponto eletrônico.");
        const resposta = await chamarPontoEletronico(action, parametros);
        if (!ativa) return null;
        if (!resposta?.ok) throw new Error(resposta?.error || "Não foi possível carregar o ponto eletrônico.");
        const dados = select(resposta);
        if (dados === undefined) throw new Error("O servidor retornou uma consulta incompleta. Atualize para tentar novamente.");
        atualizar(() => ({ key, data: dados, loading: false, success: true, error: "", lastUpdated: new Date().toISOString() }));
        return dados;
      }).catch(error => {
        atualizar(anterior => ({ ...anterior, loading: false, error: error?.message || "Não foi possível carregar o ponto eletrônico." }));
        return null;
      }).finally(() => {
        pendente = null;
        agendar();
      });
      return pendente;
    };
    const consulta = { key, refresh: executar };
    consultaAtual.current = consulta;
    if (enabled) executar();
    else atualizar(() => estadoInicial(key, false));

    const aoMudarVisibilidade = () => {
      pararTimer();
      if (enabled && leituraPermitida && pollIntervalMs > 0 && estaVisivel()) executar();
    };
    if (pollIntervalMs > 0) document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      ativa = false;
      pararTimer();
      if (pollIntervalMs > 0) document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      if (consultaAtual.current === consulta) consultaAtual.current = null;
    };
    // A chave representa os parâmetros completos. `select` pode ser inline;
    // refazer a consulta só por uma nova função causaria um loop de leituras.
  }, [key, pollIntervalMs]);

  const refresh = useCallback(opcoes => {
    const consulta = consultaAtual.current;
    return consulta?.key === key ? consulta.refresh(opcoes) : Promise.resolve(null);
  }, [key]);
  // O efeito ainda pode não ter rodado neste render. Nunca exponha o snapshot
  // da chave anterior, nem por um frame durante a troca de obra/dia/perfil.
  const atual = snapshot.key === key ? snapshot : estadoInicial(key, !!enabled);
  return { ...atual, refreshing: atual.loading && atual.success, refresh };
}

const selecionarLista = campo => resposta => {
  if (!Array.isArray(resposta[campo])) throw new Error("O servidor retornou uma consulta incompleta. Atualize para tentar novamente.");
  return resposta[campo];
};
const selecionarDispositivos = selecionarLista("dispositivos");
const selecionarMarcacoes = selecionarLista("marcacoes");
const selecionarBiometrias = selecionarLista("biometrias");
const selecionarResponsaveis = selecionarLista("responsaveis");
const selecionarEstabelecimentos = resposta => ({
  estabelecimentos: selecionarLista("estabelecimentos")(resposta), repP: resposta.repP || null,
});
const diaValido = dia => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dia))) return false;
  const data = new Date(`${dia}T12:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === dia;
};

/**
 * Recursos da consulta diária. Aparelhos dependem só da obra; os cadastros
 * globais dependem apenas do usuário/perfil. Dados históricos são atualizados
 * manualmente; o dia atual e os aparelhos têm polling após cada conclusão.
 */
export function usePontoEletronico({ obraId, dia, podeGerir = false, todasObras = false, scopeKey = "" }) {
  const enabled = !!obraId;
  const periodo = diaValido(dia) ? intervaloDoDia(dia) : null;
  const dispositivos = usePontoRecurso({
    action: "ponto-dispositivos", payload: { obraId }, select: selecionarDispositivos,
    scopeKey, enabled, pollIntervalMs: INTERVALO_ATUALIZACAO_PONTO_MS,
  });
  const marcacoes = usePontoRecurso({
    action: "ponto-marcacoes", payload: { ...(!todasObras ? { obraId } : {}), ...periodo }, select: selecionarMarcacoes,
    scopeKey, enabled: enabled && !!periodo,
    pollIntervalMs: dia === dataLocal(new Date().toISOString()) ? INTERVALO_ATUALIZACAO_PONTO_MS : 0,
  });
  const biometrias = usePontoRecurso({
    action: "ponto-biometria-status", select: selecionarBiometrias, scopeKey, enabled,
  });
  const responsaveis = usePontoRecurso({
    action: "ponto-responsaveis", select: selecionarResponsaveis, scopeKey, enabled: enabled && podeGerir,
  });
  const estabelecimentos = usePontoRecurso({
    action: "ponto-estabelecimentos", select: selecionarEstabelecimentos, scopeKey, enabled,
  });
  const recursos = { dispositivos, marcacoes, biometrias, responsaveis, estabelecimentos };
  const refresh = () => Promise.all(Object.values(recursos).map(recurso => recurso.refresh()));
  // Após mutação, uma leitura que começou antes dela não satisfaz o refresh.
  const refreshGlobais = () => Promise.all([biometrias, responsaveis, estabelecimentos]
    .map(recurso => recurso.refresh({ revalidar: true })));
  const refreshRecurso = nome => recursos[nome]?.refresh({ revalidar: true }) || Promise.resolve(null);
  return {
    recursos, refresh, refreshGlobais, refreshRecurso,
    carregando: Object.values(recursos).some(recurso => recurso.loading),
    ultimaAtualizacao: marcacoes.lastUpdated,
  };
}
