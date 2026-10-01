// Hora confiável da marcação, mesmo offline.
//
// O relógio "de parede" do Android pode ser mudado pelo usuário. Por isso o
// app guarda, a cada sincronização, um par de referência:
//   { servidorMs: hora do servidor, monotonicoMs: SystemClock.elapsedRealtime }
// O relógio monotônico só anda para frente e não muda com ajuste de hora.
// Hora da marcação = servidorMs + (monotônico agora - monotonicoMs).
//
// O monotônico zera quando o aparelho reinicia (bootId muda). Sem referência
// do boot atual, a marcação usa o relógio de parede e sai como NÃO confiável
// até a próxima sincronização - nunca se impede a batida (a Portaria veda
// restringir a marcação).
//
// A referência vem da FONTE DE HORA do servidor (server/ponto-eletronico/
// tempo/), não de um "new Date()" solto: ela traz a origem (fonte), o desvio
// medido contra a Hora Legal Brasileira e quando foi verificada. A marcação
// leva a origem e a IDADE da referência (quanto tempo desde a sincronização).

export const DIVERGENCIA_TOLERADA_MS = 2 * 60 * 1000;
// Validade da REFERÊNCIA de hora no aparelho (TIME_AUTHORITY_REFERENCE_MAX_AGE):
// depois disso sem sincronizar, a batida continua sendo registrada, mas sai
// com horaConfiavel=false. 7 dias: o relógio monotônico do Android deriva
// pouco (ordem de segundos por semana em aparelhos comuns), bem abaixo da
// tolerância de 30 s citada para o REP-P; e a obra pode ficar alguns dias sem
// internet (feriado, queda de rede) sem perder a confiabilidade. Valor
// técnico a confirmar na homologação (docs/REP-P-TEMPO-CONFIAVEL.md).
export const IDADE_MAXIMA_REFERENCIA_MS = 7 * 24 * 60 * 60 * 1000;
// A partir desta fração da validade, o diagnóstico avisa "próxima do vencimento".
export const FRACAO_AVISO_VENCIMENTO = 0.8;
// Nome antigo, mantido para quem já importava.
export const REFERENCIA_VELHA_MS = IDADE_MAXIMA_REFERENCIA_MS;

export function horaDaMarcacao({ referencia, monotonicoMs, bootId, relogioParedeMs }) {
  const parede = Number(relogioParedeMs);
  const ref = referencia || null;
  const mesmaSessao = ref && ref.bootId === bootId && Number.isFinite(Number(ref.monotonicoMs)) && Number(monotonicoMs) >= Number(ref.monotonicoMs);
  if (!mesmaSessao) {
    return { marcadoEmMs: parede, horaConfiavel: false, fonteHora: "relogio-do-aparelho", idadeReferenciaMs: null, motivo: ref ? "aparelho reiniciou desde a última sincronização" : "aparelho ainda não sincronizou a hora" };
  }
  const decorrido = Number(monotonicoMs) - Number(ref.monotonicoMs);
  const estimada = Number(ref.servidorMs) + decorrido;
  const fonteHora = String(ref.fonte || "servidor");
  if (decorrido > IDADE_MAXIMA_REFERENCIA_MS) {
    return { marcadoEmMs: estimada, horaConfiavel: false, fonteHora, idadeReferenciaMs: decorrido, motivo: "mais de 7 dias sem sincronizar a hora" };
  }
  // Fonte do servidor sem verificação válida contra a HLB: a hora estimada é
  // usada, mas a batida não sai como confiável.
  if (ref.fonteConfiavel === false) {
    return { marcadoEmMs: estimada, horaConfiavel: false, fonteHora, idadeReferenciaMs: decorrido, divergenciaMs: Math.abs(parede - estimada), relogioAlterado: Math.abs(parede - estimada) > DIVERGENCIA_TOLERADA_MS, motivo: "hora do servidor sem verificação recente contra a Hora Legal Brasileira" };
  }
  const divergencia = Math.abs(parede - estimada);
  return {
    marcadoEmMs: estimada,
    horaConfiavel: true,
    fonteHora,
    idadeReferenciaMs: decorrido,
    // A hora do celular ter sido mudada não invalida a marcação (usamos a
    // estimada), mas fica registrado para auditoria.
    relogioAlterado: divergencia > DIVERGENCIA_TOLERADA_MS,
    divergenciaMs: divergencia,
    motivo: null,
  };
}

// Estado da referência para o diagnóstico (não bloqueia nada):
// nunca_validada | invalida_apos_reinicio | valida | proxima_do_vencimento | expirada.
export function estadoDaReferencia({ referencia, monotonicoMs, bootId }) {
  const ref = referencia || null;
  if (!ref || !Number.isFinite(Number(ref.servidorMs))) return { estado: "nunca_validada", idadeMs: null, ultimaValidacao: null, fonte: null };
  const base = { ultimaValidacao: new Date(Number(ref.servidorMs)).toISOString(), fonte: ref.fonte || "servidor", fonteConfiavel: ref.fonteConfiavel !== false };
  if (ref.bootId !== bootId || !(Number(monotonicoMs) >= Number(ref.monotonicoMs))) return { ...base, estado: "invalida_apos_reinicio", idadeMs: null };
  const idadeMs = Number(monotonicoMs) - Number(ref.monotonicoMs);
  if (idadeMs > IDADE_MAXIMA_REFERENCIA_MS) return { ...base, estado: "expirada", idadeMs };
  if (idadeMs > IDADE_MAXIMA_REFERENCIA_MS * FRACAO_AVISO_VENCIMENTO) return { ...base, estado: "proxima_do_vencimento", idadeMs };
  return { ...base, estado: "valida", idadeMs };
}

// Nova referência a partir de uma resposta do servidor. Desconta metade do
// tempo de ida e volta da requisição (estimativa simples de latência).
// tempo = evidência da fonte de hora do servidor ({ source, offsetMs,
// lastVerifiedAt, confiavel, ... }); sem ela (servidor antigo), a referência
// vale como antes e a origem fica "servidor".
export function novaReferencia({ servidorMs, monotonicoEnvioMs, monotonicoRespostaMs, bootId, tempo = null }) {
  const ida = Math.max(0, Number(monotonicoRespostaMs) - Number(monotonicoEnvioMs));
  return {
    servidorMs: Number(servidorMs) + ida / 2, monotonicoMs: Number(monotonicoRespostaMs), bootId, latenciaMs: ida,
    fonte: tempo?.source || "servidor",
    fonteConfiavel: tempo ? tempo.confiavel !== false : true,
    offsetHlbMs: tempo?.offsetMs ?? null,
    verificadaEm: tempo?.lastVerifiedAt ?? null,
  };
}
