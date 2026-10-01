// PIN do responsável no aparelho, conferido OFFLINE contra o hash PBKDF2 que
// veio na sincronização (server/ponto-eletronico/handler.js → hashPin).
// pbkdf2Hex(pin, salt, iteracoes) é injetado: @noble/hashes no app,
// crypto do Node nos testes.
export function verificarPinResponsavel(pin, responsaveis, pbkdf2Hex) {
  const limpo = String(pin || "").replace(/\D/g, "");
  if (limpo.length < 4) return null;
  for (const r of responsaveis || []) {
    if (pbkdf2Hex(limpo, r.pinSalt, Number(r.pinIteracoes)) === r.pinHash) return { userId: r.userId, nome: r.nome };
  }
  return null;
}

// Trava contra tentativa e erro no aparelho: depois de 5 erros seguidos,
// espera crescente (30 s, 60 s, 120 s...).
export function proximaEsperaPin(errosSeguidos) {
  if (errosSeguidos < 5) return 0;
  return Math.min(30_000 * 2 ** (errosSeguidos - 5), 15 * 60_000);
}
