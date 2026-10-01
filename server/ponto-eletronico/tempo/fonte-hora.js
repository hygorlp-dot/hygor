// FONTE DE HORA OFICIAL do servidor do ponto (TimeAuthority).
//
// O domínio do ponto não lê "new Date()" da infraestrutura diretamente: pede
// a hora a esta fonte, que devolve a hora E a evidência de quão confiável ela
// é em relação à Hora Legal Brasileira (HLB):
//   { serverTimeMs, serverTime, source, observedAt, offsetMs, uncertaintyMs,
//     lastVerifiedAt, status, confiavel }
//
// Hoje a hora vem do relógio do host (Vercel/AWS, sincronizado por NTP do
// provedor). A rastreabilidade à HLB vem das VERIFICAÇÕES periódicas contra
// os servidores stratum 1 do NTP.br (operado com o Observatório Nacional) -
// ver tempo/ntp.js e docs/REP-P-TEMPO-CONFIAVEL.md. Isto é evidência medida,
// não declaração de conformidade.

// Tolerância citada para o REP-P (Portaria 671/2021, Anexo IX, segundo fontes
// secundárias: até 30 s em relação à HLB). CONFERIR no texto oficial vigente.
export const TOLERANCIA_HLB_MS = 30_000;
// Meta técnica interna, bem mais apertada que a norma.
export const META_INTERNA_MS = 1_000;
// Depois disso sem nova verificação, a evidência é considerada vencida. A
// rotina agendada (vercel.json) mede uma vez por dia e pode atrasar dentro da
// hora no plano atual - por isso 30 h, não 24 h.
export const VALIDADE_VERIFICACAO_MS = 30 * 60 * 60 * 1000;

export const POLITICA_PADRAO = Object.freeze({
  toleranciaMs: TOLERANCIA_HLB_MS,
  metaMs: META_INTERNA_MS,
  validadeVerificacaoMs: VALIDADE_VERIFICACAO_MS,
  // false: sem verificação nenhuma, a hora do host continua valendo como
  // confiável (comportamento anterior) - mas a evidência diz "nao_verificada".
  // true: só verificação recente e dentro da tolerância dá batida confiável.
  exigirVerificacao: false,
});

const iso = ms => new Date(ms).toISOString();

// v = última verificação gravada ({ servidor, verificadoEm, offsetMs,
// incertezaMs, ok }) ou null.
export function avaliarVerificacao(v, agoraMs, politica = POLITICA_PADRAO) {
  if (!v || !v.ok) {
    return { status: "nao_verificada", confiavel: !politica.exigirVerificacao, idadeMs: null };
  }
  const idadeMs = agoraMs - Date.parse(v.verificadoEm);
  if (!(idadeMs >= 0) || idadeMs > politica.validadeVerificacaoMs) {
    return { status: "verificacao_vencida", confiavel: !politica.exigirVerificacao, idadeMs };
  }
  const desvio = Math.abs(Number(v.offsetMs) || 0) + Math.abs(Number(v.incertezaMs) || 0);
  if (desvio > politica.toleranciaMs) return { status: "fora_da_tolerancia", confiavel: false, idadeMs };
  return { status: desvio > politica.metaMs ? "dentro_da_tolerancia" : "verificada", confiavel: true, idadeMs };
}

// relogioHost: () => ms do relógio da máquina (injetável nos testes).
// ultimaVerificacao: async () => última verificação boa (ou null).
export function criarFonteHora({ relogioHost = () => Date.now(), ultimaVerificacao = async () => null, politica = POLITICA_PADRAO, cacheMs = 60_000 } = {}) {
  let cache = null, cacheEm = -Infinity;
  const ler = async () => {
    const agora = relogioHost();
    if (agora - cacheEm > cacheMs) {
      try { cache = await ultimaVerificacao(); } catch { cache = null; }
      cacheEm = agora;
    }
    return cache;
  };
  return {
    politica,
    // Hora para regras que não são registro de ponto (validade de código etc.).
    agoraMs: () => relogioHost(),
    agora: () => new Date(relogioHost()),
    // Hora + evidência - usada em toda gravação da ARP e na referência
    // entregue aos aparelhos.
    async evidencia() {
      const v = await ler();
      const serverTimeMs = relogioHost();
      const a = avaliarVerificacao(v, serverTimeMs, politica);
      return {
        serverTimeMs,
        serverTime: iso(serverTimeMs),
        source: v?.ok ? `host+ntp:${v.servidor}` : "host",
        observedAt: iso(serverTimeMs),
        offsetMs: v?.ok ? Number(v.offsetMs) : null,
        uncertaintyMs: v?.ok && v.incertezaMs !== null && v.incertezaMs !== undefined ? Number(v.incertezaMs) : null,
        lastVerifiedAt: v?.ok ? v.verificadoEm : null,
        status: a.status,
        confiavel: a.confiavel,
        toleranciaMs: politica.toleranciaMs,
      };
    },
    limparCache() { cacheEm = -Infinity; },
  };
}
