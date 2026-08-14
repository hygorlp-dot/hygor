// Única fonte para o cálculo de retenção de terceiros — usada tanto no
// preview da tela (LegacyApp.jsx, como calcRetencoes) quanto no valor
// efetivamente gravado no pagamento (financeiro/third-party-commands.js,
// paymentAmounts). Arredondamento em centavos evita que as duas pontas
// divirjam por erro de ponto flutuante para a mesma configuração de
// retenção.
//
// O valor bruto continua sendo o custo reconhecido da obra. As retenções
// alteram somente a composição da liquidação quando a empresa é a fonte.
const retentionCents = (grossCents, contractor, field) => {
  if (contractor?.[`${field}Quem`] !== "fonte") return 0;
  const rate = Number(contractor?.[field] || 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return NaN;
  return Math.round(grossCents * rate / 100);
};

export function calculateWithholdings(grossAmount, contractor) {
  const grossCents = Math.round(Number(grossAmount || 0) * 100);
  const issCents = retentionCents(grossCents, contractor, "retISS");
  const inssCents = retentionCents(grossCents, contractor, "retINSS");
  const retainedCents = issCents + inssCents;
  if (!Number.isFinite(retainedCents) || retainedCents > grossCents) {
    return {
      bruto: grossCents / 100,
      issRetido: 0,
      inssRetido: 0,
      retido: 0,
      liquido: grossCents / 100,
      error: "As retenções configuradas no contrato são inválidas.",
    };
  }

  return {
    bruto: grossCents / 100,
    issRetido: issCents / 100,
    inssRetido: inssCents / 100,
    retido: retainedCents / 100,
    liquido: (grossCents - retainedCents) / 100,
  };
}
