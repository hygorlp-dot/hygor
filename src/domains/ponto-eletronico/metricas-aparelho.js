// Contrato das métricas de fila/desempenho que o app do ponto manda em
// "ponto-sincronizar" (campo `aparelho`) e que o servidor guarda junto da
// identificação do aparelho. Puro: usado pelo app (apps/ponto-obra) e pelo
// servidor (server/ponto-eletronico/handler.js) para a lista e os limites
// nunca divergirem.
//
// Só NÚMEROS de operação do aparelho - nada pessoal: sem nome, CPF, id de
// funcionário, horário de batida, foto ou dado biométrico.

// campo -> maior valor aceito (acima disso é truncado).
export const METRICAS_APARELHO = Object.freeze({
  batidasPendentes: 1_000_000,       // eventos na fila local ainda não gravados pela ARP
  fotosPendentes: 1_000_000,         // fotos aguardando upload
  pendenteMaisAntigaMin: 525_600,    // idade (min) da batida pendente mais antiga; 1 ano no máximo
  minDesdeEnvioOk: 525_600,          // minutos desde a última rodada de envio sem erro
  reconhecimentoP95Ms: 600_000,      // p95 do reconhecimento facial no aparelho (toque até identificar)
});

// Só campos conhecidos, só número finito >= 0 (texto, booleano, negativo e
// NaN são descartados), inteiro e limitado ao máximo do campo.
export function limparMetricasAparelho(bruto) {
  if (!bruto || typeof bruto !== "object") return {};
  const limpo = {};
  for (const [campo, maximo] of Object.entries(METRICAS_APARELHO)) {
    const v = bruto[campo];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) continue;
    limpo[campo] = Math.min(Math.round(v), maximo);
  }
  return limpo;
}
