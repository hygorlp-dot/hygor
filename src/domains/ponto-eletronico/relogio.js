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

export const DIVERGENCIA_TOLERADA_MS = 2 * 60 * 1000;
export const REFERENCIA_VELHA_MS = 7 * 24 * 60 * 60 * 1000;

export function horaDaMarcacao({ referencia, monotonicoMs, bootId, relogioParedeMs }) {
  const parede = Number(relogioParedeMs);
  const ref = referencia || null;
  const mesmaSessao = ref && ref.bootId === bootId && Number.isFinite(Number(ref.monotonicoMs)) && Number(monotonicoMs) >= Number(ref.monotonicoMs);
  if (!mesmaSessao) {
    return { marcadoEmMs: parede, horaConfiavel: false, motivo: ref ? "aparelho reiniciou desde a última sincronização" : "aparelho ainda não sincronizou a hora" };
  }
  const decorrido = Number(monotonicoMs) - Number(ref.monotonicoMs);
  const estimada = Number(ref.servidorMs) + decorrido;
  if (decorrido > REFERENCIA_VELHA_MS) {
    return { marcadoEmMs: estimada, horaConfiavel: false, motivo: "mais de 7 dias sem sincronizar a hora" };
  }
  const divergencia = Math.abs(parede - estimada);
  return {
    marcadoEmMs: estimada,
    horaConfiavel: true,
    // A hora do celular ter sido mudada não invalida a marcação (usamos a
    // estimada), mas fica registrado para auditoria.
    relogioAlterado: divergencia > DIVERGENCIA_TOLERADA_MS,
    divergenciaMs: divergencia,
    motivo: null,
  };
}

// Nova referência a partir de uma resposta do servidor. Desconta metade do
// tempo de ida e volta da requisição (estimativa simples de latência).
export function novaReferencia({ servidorMs, monotonicoEnvioMs, monotonicoRespostaMs, bootId }) {
  const ida = Math.max(0, Number(monotonicoRespostaMs) - Number(monotonicoEnvioMs));
  return { servidorMs: Number(servidorMs) + ida / 2, monotonicoMs: Number(monotonicoRespostaMs), bootId, latenciaMs: ida };
}
