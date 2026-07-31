// O valor bruto continua sendo o custo reconhecido da obra. As retenções
// alteram somente a composição da liquidação quando a empresa é a fonte.
export function calculateWithholdings(grossAmount, contractor) {
  const bruto = Number(grossAmount || 0);
  const issRetido = contractor?.retISSQuem === "fonte"
    ? bruto * Number(contractor?.retISS || 0) / 100
    : 0;
  const inssRetido = contractor?.retINSSQuem === "fonte"
    ? bruto * Number(contractor?.retINSS || 0) / 100
    : 0;
  const retido = issRetido + inssRetido;

  return {
    bruto,
    issRetido,
    inssRetido,
    retido,
    liquido: bruto - retido,
  };
}
