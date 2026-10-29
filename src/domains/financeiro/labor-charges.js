// Encargos e provisões sobre a mão de obra (Onda 2 do roadmap de correção).
//
// Até 28/10/2026 o DRE custeava todo funcionário só pela diária do ponto: o
// CLT entrava sem INSS patronal, FGTS nem provisão de 13º/férias, e a margem
// da obra parecia maior do que era. Aqui sai o percentual que se soma ao custo
// do dia trabalhado (e do feriado pago), por modalidade de remuneração.
//
// Padrão da empresa (28/10/2026): Simples Nacional, Anexo IV (construção) -
// CPP 20% + RAT × FAP recolhidos fora do DAS, sem terceiros. RAT 3% (CNAE
// 4120-4/00) e FAP 1,0 são padrões a confirmar na guia da empresa; tudo é
// editável em config.laborCharges.

export const DEFAULT_LABOR_CHARGES = Object.freeze({
  inssPatronalPercent:20,
  ratPercent:3,
  fap:1,
  terceirosPercent:0,
  fgtsPercent:8,
  // Reserva da multa do FGTS: 40 (dispensa sem justa causa), 20 (acordo) ou 0.
  multaFgtsPercent:40,
  provisionar13Ferias:true,
  // Diaristas/autônomos: sem encargo por padrão (informar 20 se a empresa
  // recolhe INSS sobre pagamentos a autônomo via RPA).
  diaristaPercent:0,
});

const pct = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
};

export const laborChargesConfig = (config = {}) => {
  const raw = config?.laborCharges || {};
  const fap = Number(raw.fap);
  return {
    inssPatronalPercent:pct(raw.inssPatronalPercent, DEFAULT_LABOR_CHARGES.inssPatronalPercent),
    ratPercent:pct(raw.ratPercent, DEFAULT_LABOR_CHARGES.ratPercent),
    fap:Number.isFinite(fap) && fap >= 0.5 && fap <= 2 ? fap : DEFAULT_LABOR_CHARGES.fap,
    terceirosPercent:pct(raw.terceirosPercent, DEFAULT_LABOR_CHARGES.terceirosPercent),
    fgtsPercent:pct(raw.fgtsPercent, DEFAULT_LABOR_CHARGES.fgtsPercent),
    multaFgtsPercent:[0, 20, 40].includes(Number(raw.multaFgtsPercent)) ? Number(raw.multaFgtsPercent) : DEFAULT_LABOR_CHARGES.multaFgtsPercent,
    provisionar13Ferias:raw.provisionar13Ferias !== false,
    diaristaPercent:pct(raw.diaristaPercent, DEFAULT_LABOR_CHARGES.diaristaPercent),
  };
};

// Fator CLT sobre a remuneração do período:
//   provisões  p = 1/12 (13º) + 1/12 × 4/3 (férias + 1/3)
//   encargos sobre remuneração + provisões = (1 + p) × (patronal + FGTS × (1 + multa))
//   fator = encargos + p
export const cltChargeFactor = (config = {}) => {
  const c = laborChargesConfig(config);
  const provisoes = c.provisionar13Ferias ? 1 / 12 + (1 / 12) * (4 / 3) : 0;
  const patronal = (c.inssPatronalPercent + c.ratPercent * c.fap + c.terceirosPercent) / 100;
  const fgts = (c.fgtsPercent / 100) * (1 + c.multaFgtsPercent / 100);
  return (1 + provisoes) * (patronal + fgts) + provisoes;
};

// MEI: valor do contrato sem encargo patronal (atividade fora do art. 18-B
// da LC 123/2006, decisão do dono em 29/10/2026).
export const laborChargeFactor = (mode, config = {}) =>
  mode === "clt" ? cltChargeFactor(config) : mode === "mei" ? 0 : laborChargesConfig(config).diaristaPercent / 100;
